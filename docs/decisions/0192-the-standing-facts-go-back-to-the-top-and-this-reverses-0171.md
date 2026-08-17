# 0192: The standing facts go back to the top, and this reverses 0171

Date: 2026-08-17
Status: Accepted. Home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)), Stage C row C8.
**Reverses one decision inside
[ADR 0171](0171-an-instruction-is-read-once-so-home-has-two-lives-and-a-counter-with-no-reading-is-dark-rather-than-zero.md).**

## Context

ADR 0171 moved the shortcut out of the most prominent position on Home. Its
argument was that **an instruction is read exactly once**, and it was right about
what it was looking at: two 42 px keycaps and the sentence *Press in any app to
dictate*, occupying the best surface in the product to say something nobody
needs said twice. The caps went, the counters took the position, and the
shortcut moved to a line of small caps at the FOOT of the hero.

The owner has now used that arrangement and wants the line back at the top, more
prominent.

This is a reversal and has to be written down as one. ADR 0173 already reversed
a decision inside ADR 0172 the day after the owner saw the result; the track's
own rule is that **a reversal that is not written down is a defect the next
reader re-introduces on purpose** — they find 0171, read a good argument, and
move the line back down.

## Decision

**`HeroFacts` stands before the display block, and the rule between them changes
ends: `border-top` becomes `border-bottom`.**

**ADR 0171 was right about the keycaps and wrong about the line, and the two are
not the same object.** The caps were an INSTRUCTION — how to start the product,
for somebody who has not started it. The line is not:

> Press `Ctrl`+`Super` in any app · Next dictation runs as **Cleanup** ·
> **Founder ops notes**

That is *what is about to happen when I press it* — which mode the next
dictation runs as, which profile is live, which keys. **A reader has that
question every day, not once.** It is the one thing on this screen that is about
the future rather than about the record, which is a reason to put it first
rather than a reason to bury it.

The gate ADR 0171 built is untouched: the block below still has two lives, the
instruction still stands there before the first dictation, and a fresh profile
still never sees four zeroes.

**The rule moves because a `border-top` on the first element in a block draws a
line against the screen's own top margin**, which reads as a stray hairline
rather than as a separator. It was the display's foot; it is the display's head.

## Consequences

ADR 0171's finding survives in the part that was actually about instructions.
What is retired is the placement of `HeroFacts`, and only that.

The line stays centred (ADR 0186's reason: what is above it is centred too — now
what is BELOW it is), and `Change in profile` stays at its end rather than
pinned to the far edge.
