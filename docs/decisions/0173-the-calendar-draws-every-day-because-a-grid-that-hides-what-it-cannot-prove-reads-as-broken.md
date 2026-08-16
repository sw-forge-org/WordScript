# 0173: The calendar draws every day, because a grid that hides what it cannot prove reads as broken

Date: 2026-08-16
Status: Accepted. **Supersedes the "grid has a floor, and days below the window
are drawn as nothing" decision in
[ADR 0172](0172-an-unlit-cell-is-an-assertion-so-the-calendar-spans-what-the-record-can-vouch-for-and-nothing-more.md)**,
which was written and shipped the same day and reversed by the owner on sight.
Everything else in 0172 stands — the vendored library, the circles on the matrix
ramp, the fixed steps, the tooltip, the switch, and `activityWindow` itself.
Third record of the home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)).

## Context

ADR 0172 established that an unlit cell is an assertion — *you did not dictate
that day* — and that `history.json` is pruned by age and by count, so the
assertion only holds inside the window the file still reaches over. That part was
correct and is not in question.

From it, 0172 drew a further conclusion: **the grid should narrow to that window
and draw the rest as blank space**, with a four-column floor. On the machine it
was built against — `history_limit: 50`, `history_retention_days: 7`, fifty
records all from one day — that produced a four-column box with a single column
of circles in it, under the line *"The last 1 days"*.

The owner saw it and rejected it. Three things were wrong, and the reasoning
error is the interesting one.

## Decision

### The grid is always the full twenty-six weeks, and every day in it gets a circle

**The epistemic argument was real but it was answering a question nobody asked.**
A run of unlit days is not an accusation the display has to shield the reader
from. It is the shape of a half-year filling up — and as the owner put it, seeing
it fill is motivating rather than accusatory. The display was protecting the
reader from information they wanted.

**And the cure was worse than the disease it treated.** A calendar of two columns
floating in an empty box does not read as *the record cannot vouch for more*. It
reads as *this software is broken*. Trading a claim that is slightly too strong
for an appearance of failure is a bad trade: the reader who sees a collapsed grid
learns nothing at all, while the reader who sees grey circles learns the true
thing — that those days were quiet — and is wrong only about the narrow question
of whether a record was pruned or never existed.

So the grid is constant, the ramp carries the information, and how far back the
record actually reaches is **one plain line underneath**: `The last 26 weeks ·
your records go back 7 days.` That line is a fact about the history file, not a
caveat about the drawing, and it is also the only thing that ever tells a reader
their retention settings are doing something.

`activityWindow` survives unchanged and is still the only place that knows how
far the record reaches. It sizes nothing now; it feeds that sentence.

### The labels are coloured through the vendored library's own hook

The vendored heat map sets `color: var(--rhm-text-color, #24292e)` as an **inline
style** on the `<svg>`, and `textStyle` fills from `currentColor`. An inline style
beats every rule in `shell.css`, so the month labels were painting a near-black
`#24292e` regardless of scheme — invisible on the dark ground, and not following
the theme on either. Defining `--rhm-text-color: var(--fg-dim)` on `.ws-cal` is
the one way to reach them and is upstream's own intended hook. **Reaching into a
vendored component through the variable it publishes is right; overriding its
inline style from outside would have been a patch.**

### The pads are applied once

`Day` wraps every cell in `<g transform="translate(5, 20)">`, so the `x`/`y` a
`rectRender` receives are **already** relative to the padded origin. Adding the
pads again in the render override shifted all 182 circles right and down by
(5, 20) and pushed the last column and the bottom row past the viewBox edge.

**The eye does not read that as "shifted". It reads it as "why is that circle
only three quarters of a circle".** That is how the defect was reported, and it is
worth recording because it is the general shape of a clipping bug: the symptom
names the wrong object. A test now asserts that no cell's bounding circle crosses
the viewBox on any side, which is a property no amount of looking at coordinates
would have caught.

## Consequences

**A correctness argument can be right about the fact and wrong about the
remedy.** 0172's premise holds: history is pruned, and absence of a record is not
evidence of absence of a dictation. What it got wrong was jumping from *this cell
overstates its confidence* to *therefore do not draw the cell*. The proportionate
remedy was a sentence, not a hole. That is worth carrying: **when a display would
have to hide something to stay strictly honest, the honest thing is usually a
caption, not a gap.**

**Two of the suite's cases were deleted rather than rewritten, and that is
correct here.** They asserted the four-column floor and the blank cells — the
behaviour this record removes — so keeping them would have pinned a design that
no longer exists. Two new cases assert the opposite: the grid holds 470 px and
twenty-six columns even where the record reaches back a single day, and no cell
is clipped. The track's standing rule that a step should not lose a case is about
not deleting cases to make a step green; deleting the cases for a reversed
decision is the other thing.

**The dark-scheme colour of a vendored component is not checkable in jsdom**, and
this one was wrong from the first build without failing anything. It was found by
reading computed `fill` in a browser under both schemes — `rgb(194, 191, 184)` on
dark, `rgb(85, 80, 74)` on light — which is now the check that keeps it honest.
