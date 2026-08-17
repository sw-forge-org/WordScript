# 0183: The calendar is a year you scroll through, and only a period the record can speak for

Date: 2026-08-16
Status: Accepted. Thirteenth record of the home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)). Extends the display
[ADR 0172](0172-an-unlit-cell-is-an-assertion-so-the-calendar-spans-what-the-record-can-vouch-for-and-nothing-more.md)
and
[ADR 0173](0173-the-calendar-draws-every-day-because-a-grid-that-hides-what-it-cannot-prove-reads-as-broken.md)
settled, and keeps both of their rules.

## Context

The calendar drew a fixed twenty-six weeks ending today and nothing else: no way
back, no way to compare one stretch with another, and no key to the ramp. The
owner asked for GitHub's arrangement — scroll left and right, pick a year, read
the ramp off a legend.

Three things stood in the way of simply adding them.

**The block was a `<button>`.** Decision 9 made the whole display the control
that swaps it for the counters, and interactive content inside a `<button>` is
invalid HTML that behaves like it: every press of an arrow would also swap the
view.

**A year picker can offer years the record cannot draw.** The ledger keeps 800
day rows and retires the rest into the totals
([ADR 0176](0176-a-lifetime-figure-that-can-fall-is-not-a-lifetime-figure-so-a-pruned-day-is-retired-and-only-a-button-clears-it.md)):
the figures survive a prune and the days do not. A year offered on the strength
of an install date would therefore draw as a grid of unlit circles — which
asserts *you dictated on none of these days* about days the record can no longer
speak for, and that is the claim ADR 0172 forbade.

**And the weekday labels were inside the drawing.** Upstream reserves a 28 px
gutter within the SVG, so the first thing a scroll to the right takes away is the
one part of the grid a reader cannot reconstruct from the rest.

## Decision

**The period is a year, and only a year.** A rolling *last 26 weeks* entry stood
beside the years for one build and was the same thing twice: the box shows about
that many weeks whatever year is chosen, so the rolling window was a second name
for the position a year already opens at. The picker is a pop-up at the top
right — GitHub stands a column of years beside the grid, which works at its width
and not at 696 px of content column.

**A year opens at its newest end.** Today for the current year, December for a
past one: one rule rather than a special case, and the newest thing the chosen
year holds is what a reader opening the calendar came for. The current year stops
at today, because drawing the rest of it would be four months of unlit circles
about days that have not happened.

**Only years the ledger holds day rows for are offered, plus the current one.**
The current year is always in the list because it is the year on screen and a
picker may not fail to name what it is showing. The line under the grid names the
install date, which is where the difference between *nothing happened* and *the
rows were pruned* becomes visible.

**The box is twenty-six WHOLE columns and the scroll position is snapped to
one.** Cell `k` starts at `5 + k × 18` inside the drawing, so a clean left edge
means a scroll position congruent to 5, not a multiple of 18 — the first build
got that wrong in both places at once, sized the box to include upstream's 5 px
pad and snapped to a bare multiple, and at the far end the leftmost column stood
13 px into itself. A free scroll is rounded to a column once it settles, so a
trackpad cannot leave a sliver of next week at the edge either.

**The weekday labels are a pinned column outside the box**, at the vendored
file's own row pitch and its month labels' own 5 px offset from the grid. They
are drawn on the rows' centre lines rather than at upstream's baseline, which sat
two pixels low — invisible in a gutter inside the drawing and obvious once the
labels stand beside it.

**The ramp has a legend, bottom right.** It was left out on the argument that the
tooltip already explains every cell and a legend would be a second explanation of
one thing. That is true of one cell and false of the grid: the scale is a
question about all of them at once, and hovering thirty cells to infer it is not
an answer.

**And the swap is a layer behind the view rather than a wrapper around it.** The
hit area fills the block, the view is painted over it and is transparent to the
pointer, and only the controls take pointer events back — the picker, the arrows,
the scroller, the cells, and the counter tiles' labels, which carry the tooltips.
Everything else still swaps on a click, which is the affordance decision 9 asked
for. The hit layer carries no `title`: on a wrapping button that was one tooltip
on one object, and as a full-bleed layer it is a tooltip that follows the cursor
across the whole block, including over the day panel the reader actually asked
for.

## Consequences

- The display is wider by the legend and the picker and unchanged in cell size: a
  year squeezed into a half-year's width would be a different display rather than
  the same one further out.
- Nothing is offered that cannot be drawn. On a fresh install the picker holds one
  year, which is honest rather than broken.
- The arrows are disabled at each end. That is a reading of the span, not a
  state to hide.
- jsdom lays nothing out, so the scroll arithmetic is asserted as arithmetic in
  the tests and measured in the browser: 0 clipped cells at either edge, scroll
  position 149 ≡ 5 (mod 18), weekday labels on the row centres to the pixel.
