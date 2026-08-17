# 0189: A marker is a day with a name, and it never joins the ramp

Date: 2026-08-17
Status: Accepted. Home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)), Stage C rows C1,
C2, C4, C5 and C6. Extends
[ADR 0183](0183-the-calendar-is-a-year-you-scroll-through-and-a-period-it-can-speak-for.md)
and fixes one defect it left behind.

## Context

The calendar has had exactly one kind of day since it was built: a day with a
number behind it, painted somewhere on the five-step ramp
[ADR 0187](0187-a-ramp-whose-every-real-value-is-the-maximum-is-not-a-ramp.md)
rescaled. The owner asked for a second kind — a day that matters because of what
happened to the PRODUCT rather than because of how much was dictated on it.
Two of them: WordScript's publication on GitHub, and the day this reader
installed it.

That is not a count, and this display's entire argument is about counts. An
unlit circle asserts *you did not dictate that day*; a lit one asserts how much.
There is no honest place on that scale for *this is the day the product was
published*, because the ramp answers a question a marker does not have.

Three smaller things came with it and all four are one change to one component:

- **The left arrow lied about the end of the record.** `measure()` set
  `left: node.scrollLeft > 1`, and this scroller does not rest at zero.
  `snapped()` is congruent to `GRID_LEFT_PAD` deliberately — a position
  congruent to 0 shaves a circle at both edges, which ADR 0183 took two passes
  to remove — so the settle parks the box at 5 and `5 > 1` stays true. Pressing
  it set a negative position, the browser clamped to 0, and the settle put it
  back at 5. The right arrow was correct all along, because the far end lands on
  `max` exactly.
- **The legend is `aria-hidden` in full**, which is right for a run of
  unlabelled swatches and wrong the moment an entry carries a name.
- **The year picker offers only years the ledger holds day rows for**, which is
  right for a ramp and makes a 2026 publication date unreachable on any machine
  installed in 2027.

## Decision

**A marker is a day with a NAME rather than a count, and it never joins the
ramp.** The step is computed from the day's dictations alone and is not touched
by the marker; the marker arrives as a second shape.

- A marked day with no dictation is a **green fill** at full opacity. Step 0's
  dimming says *nothing happened here*, which is the one claim a named day may
  not carry.
- A marked day that was also dictated on **keeps the accent fill at its own ramp
  step** and takes a **green ring**. The ring is drawn INSIDE the radius the
  fill already occupies — `r = CELL_RADIUS - stroke / 2` — because a stroke sits
  half in and half out of the circle it is on, and a ring drawn at the radius
  would reach past it. With a 3 px gutter, two markers on adjacent days would
  then come within 1.5 px of touching and read as one smeared shape.
- **The marker has its own legend entry, out of the hidden region**, and the
  ramp stays inside it. One word — `Milestone` — because it is a key and not a
  sentence; WHICH day is named is on the hover, where the name is.
- **The tooltip carries the name above the day's own readings.** It is why the
  reader stopped on this cell; making them read past two counts to find it would
  answer a question they did not ask.
- **A year that carries a marker is offered by the picker**, even with no day
  rows in it. A marker is not a row and makes no claim about days the record
  cannot speak for, so ADR 0183's rule is not weakened — it is scoped to what it
  was about.
- **Two names on one day fold into one entry.** A reader who installed
  WordScript the day it was published has one anniversary, and two circles
  cannot share a cell.

**The arrow's threshold moves and the snap does not.** `left` is now
`scrollLeft > GRID_LEFT_PAD + 1`. Clamping `snapped()` to zero would have
disabled the arrow correctly and brought the shaved circle back with it, which
is trading a live defect for a fixed one.

The settle handler also re-measures after it moves the box. The settle is the
last thing that touches this scroller, so it is the only moment at which *is
there anything that way* can be answered about where the box actually is.

## Consequences

The calendar now says two kinds of thing, and a reader has to be able to tell
them apart without hovering — which is why the legend entry is not optional and
why it is the one entry that is announced.

A case pins the arrow **after the settle has run**. Straight after the click the
position is a bare 0, `0 > 1` is false, and the arrow reads disabled — so a case
that asserted there would have passed on the broken build. jsdom lays nothing
out, so the box's geometry is stubbed to a browser's.

The publication date is hardcoded. It is a fact about the project rather than
about this installation, so there is nothing for the runtime to measure. The
install date is not, and where it comes from is
[ADR 0190](0190-the-install-date-is-a-ledger-field-because-a-config-field-would-be-somebody-elses-install.md).
