# 0172: An unlit cell is an assertion, so the calendar spans what the record can vouch for and nothing more

Date: 2026-08-16
Status: Accepted. Second record of the home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)), which owns
ADR 0171–0180. Closes Stage A by building steps A3, A4 and A5 on top of
[ADR 0171](0171-an-instruction-is-read-once-so-home-has-two-lives-and-a-counter-with-no-reading-is-dark-rather-than-zero.md),
which gave Home's opening block its two lives. Carries
[ADR 0161](0161-a-drawn-row-says-so-beside-its-own-label-and-the-sketch-is-the-deliverable.md)'s
per-row marker into a tooltip, and copies
[ADR 0111](0111-the-sidebar-has-two-widths-and-the-layout-measures-the-column-it-is-drawn-in.md)'s
preference-versus-state shape for the view switch. Additive config field, so
[ADR 0054](0054-the-rework-lands-as-an-overwrite-because-there-is-nobody-to-migrate.md)
applies and nothing is migrated.

## Context

ADR 0171 gave Home's opening block two lives: the instruction before the first
measured dictation, four counter tiles after it. The track's decision 1 gives
the second life two views rather than one — an activity calendar *or* the tiles,
never both — because they answer different questions. The calendar is your
rhythm, day by day; the tiles are your character, averaged. The tiles are allowed
to be slow-moving precisely because the calendar carries the movement.

Building the calendar surfaced a problem the track had not seen, and it is the
whole of this record.

**An unlit cell is not decoration. It is a sentence: *you did not dictate that
day*.** A GitHub contribution graph can make that claim safely because its
source is an append-only log that never forgets. WordScript's source is
`history.json`, and history is **pruned on every read, by two independent arms**:

- `history_retention_days` drops anything older than the horizon.
- `history_limit` drops the oldest records once the file is full, *whatever
  their age*.

The second arm is the one that bites, and it is easy to miss. A saturated
history cannot vouch for any day before its own oldest record — even a day well
inside the retention horizon — because the records that would have proved it are
exactly the records that were dropped.

**Measured on the machine this was written against**, and the numbers are not a
hypothetical: `history_limit: 50`, `history_retention_days: 7`, fifty records
held, every one of them from a single day. A twenty-six week display built
naively from that file would have drawn **one hundred and eighty-one confident
grey circles**, each asserting a fact the file cannot support, around one lit
one. That is the plausible-wrong-number failure class this repository keeps a
whole track for, drawn at a hundred and eighty-one times life size.

## Decision

### The display spans the window the record can vouch for

`activityWindow` in `lib/activity.ts` takes the narrowest of three bounds and
reports **which one bit**:

| Bound | What it means |
|---|---|
| `span` | Nothing pruned it back; the full twenty-six weeks. |
| `retention` | `history_retention_days` is the binding constraint. |
| `limit` | The file is saturated and reaches no further back than its own oldest record. |

The surface prints that in words under the grid, because a calendar two columns
wide is either a young install or a pruned history and **the reader cannot tell
those apart by looking at it**.

### The cap is a column count, not a day count

Twenty-six weeks is 182 days, and 182 days ending mid-week touch **twenty-seven**
calendar weeks — twenty-five whole ones plus the two part-weeks at each end.
Twenty-seven columns is 488 px where the track's decision 8 decided 470. So the
span is counted backwards in whole columns: this week so far, and twenty-five
complete weeks before it.

### The grid has a floor, and days below the window are drawn as nothing

Decision 7 forbids a display that sits at nothing, and it was written about a
fresh install. The measured case is worse: a window one column wide is not a
calendar, it is a defect with a caption. So the **grid** is at least four weeks
while the **window** stays whatever it is, and the difference is drawn as blank
space.

**Blank, and specifically not unlit.** An unlit circle claims nothing was
dictated; a blank claims nothing at all. That is the same distinction ADR 0171
drew between a dark counter and a lit `0`, one level out: *no reading* and *a
reading of none* are different facts, and a display may not spell one as the
other. The block then reads the way decision 7 asks for — a shape that fills
rightwards as the record deepens — instead of collapsing.

### The steps are fixed, not quartiles of the busiest day

One, three, six and eleven dictations. GitHub scales its ramp to the maximum and
the vendored library's `convertPanelColors` does the same; both make a colour
change meaning when an unrelated day gets busier, so the same two dictations are
step 4 one week and step 1 the next and the reader learns nothing they can carry.
Worse, a history holding exactly one dictation would paint it the brightest step.
Fixed thresholds make a colour an absolute claim about a day.

### Everything day-scoped lives in the tooltip

This is what dissolves the "which four metrics" problem. Sessions that day, the
longest one, words, how many of them carried a clock — none needs a tile, because
each is a property of a day rather than of a person. A tooltip may be rich,
because only a reader who went looking sees it.

A day with nothing in it **says so in words**. A row of noughts claims five
counts were taken and all came back nought; the truth is that nothing happened.
Meetings and uploads hold their lines with `PreviewTag` and **no figure at all** —
origins that do not exist yet, where a `0 meetings` would be precisely the
invented reading ADR 0161 exists to forbid.

### The switch is on the thing

`AppConfig.home_activity_calendar`, additive, `#[serde(default)]`, on the shape
`workspace_nav_rail` already has. Clicking the block toggles it; a two-dot
carousel indicator is the discoverability. **No settings row**, per decision 9.

**The default is the tiles, and that is not arbitrary.** The calendar can only
draw the window the history file reaches over, so a machine with a pruned history
would open on a near-empty grid — the state decision 7 forbids. The tiles degrade
to a rate and a window, both of which read correctly from a single day of
records.

### The library is vendored, and it carries one structural change

`@uiw/react-heat-map` @ `86a3d0b`, MIT, flattened into
`src/components/ui/heat-map.tsx` with the provenance header `matrix.tsx` uses. It
was chosen over the more popular `react-activity-calendar` for `rectRender`,
which replaces the emitted element wholesale — so drawing circles on the matrix
ramp is a render override and **not a fork**.

The one structural change is the column count. Upstream measures
`svgRef.current.clientWidth` in an effect and divides by the cell pitch, so the
calendar shows however many weeks happen to fit. **A calendar that fills its
container states a window it did not choose**, which is the opposite of this
whole record. It is also 0 in jsdom, so the measured version renders no days at
all under test and the suite would grade an empty `<g>` and pass.

## Consequences

**The calendar and the counter are two states of one display.** The cells are the
matrix's own circle to the number — `r = (size / 2) * 0.9`, the accent as fill,
intensity as `opacity` — so this is a mark for the product rather than a borrowed
GitHub graphic. That was decision 2's whole point and it is why the ramp is
carried in `opacity` rather than mixed towards the accent by some other
mechanism, which would land on slightly different pixels.

**The calendar is close to useless on a heavily pruned history, and the display
now says so instead of lying about it.** On the machine measured above it draws
one real column inside a four-column grid. Raising `history_limit` and
`history_retention_days` widens it from that day forward; nothing recovers what
pruning has already dropped. The durable fix is the track's Stage B row B3 — a
per-day aggregate that survives pruning — and this record is the evidence for
why that row is worth its cost. **Stage A takes the window labels; Stage B
decides on counters**, and this ADR does not pre-empt that.

**A presentation attribute does not beat a stylesheet rule, and ADR 0171's trap
note said it did.** Measured here: `.ws-win svg { width: 16px; height: 16px }` —
the unscoped prototype rule — rendered the 470 px calendar at **16 × 4.86 px**,
aspect ratio intact and size gone. Presentation attributes sit in their own layer
*below* all author layers, so any rule beats them. What beat the counter's rule
was narrower than the note claimed: the attribute set `width` where the rule only
set `max-width`, which is a different fight. `.ws-matrix-wrap svg` escapes the
same rule the same way this now does.

**A component owns its own shrinking.** `min-width: 0` on the calendar's block is
the whole of it: a grid or flex item's automatic minimum size is its min-content,
which here is the 470 px display, so without it the calendar refuses every box
narrower than itself and overflows rather than scaling — whatever the host
declares. Measured at a 398 px stage.
