# 0184: A list is paged, and a screen offers what it used to recite

Date: 2026-08-16
Status: Accepted. Fourteenth record of the home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)) — Home's half by
ownership, History's half because the same session and the same owner reading
drove both, and no track claims that screen. Extends
[ADR 0183](0183-the-calendar-is-a-year-you-scroll-through-and-a-period-it-can-speak-for.md)
and does not disturb it.

## Context

The owner used the two surfaces and reported four things.

**The block on Home had no visible control.** ADR 0183 made the swap a layer
behind the view, which fixed the calendar's own controls and left the
discoverability where it already was: on a reader guessing that a block of
read-outs is clickable. The two dots under it said which view was showing and
could not be pressed — `aria-hidden` decoration next to an invisible button.

**History was one unbroken list.** It draws whatever the runtime returns, capped
by `history_limit` — 200 by default and 1000 at its widest — as a single scroll
of three-line rows. There was no way to say how many to see at once, no way to
say *the ones from June*, and no way back to where you were.

**Its foot recited four facts nobody could act on there:** the transcripts
folder, the index file, the retention days and the cap. The folder was a path to
copy by hand; the two numbers live in Privacy & Data, which the sentence named
and could not open — its link was an `<a href="#">` with no handler.

**And a count stood over the list** — `60 transcriptions` — which is the same
figure the reader wants while paging, in the one place they are not looking when
they want it.

The owner also asked how turnaround is computed for a clipboard-only delivery,
where the reader may take twenty seconds to paste. **No change: that is already
the definition.** `turnaround_ms` is taken when the transformed text exists,
before the preview is staged (ADR 0181, carried to the commit by ADR 0182), so
what it measures is the wait until the product is ready — never the reader's own
pause afterwards.

## Decision

**The dots are the manual switch.** Two buttons, each SELECTING its view rather
than toggling: with exactly two views, *go to the calendar* is a shorter thought
than *go to the other one*, and pressing the dot you are on writes the view you
are on rather than bouncing you away. Five pixels of ink and sixteen of target —
the pads may not overlap, or a press near the seam would land on whichever dot is
later in the DOM. The dots name their view (`Counters`, `Activity calendar`) and
the hit area behind them keeps `Show the …`: two controls with one accessible
name would be announced twice and read as a duplicate.

**The calendar carries one figure over the grid: active days in the drawn year.**
Days and not dictations, and the owner picked it. GitHub counts contributions and
can, because a commit is a unit somebody chose to make; one long thought and
eight false starts are the same afternoon, and a headline that counted them would
reward the worse of the two. It is counted off the same buckets the cells are
painted from, so the figure and the drawing cannot disagree.

**History is paged, at a size the reader sets.** 10, 25, 50 or 100, default 25 —
the floor of `history_limit`'s own clamp, so the smallest history this product
can hold is exactly one page and the control appears only when there is something
to page through. The paging is done in the screen and not in the query: the whole
filtered set is already here, and asking the runtime for a window would mean two
round trips per page. Changing the size keeps the record at the top of the page
at the top of the page; narrowing the set starts it at its own first page.

**And it has a month filter, defaulting to all time.** The transcripts are
written into `YYYY/MM/` folders and the list was the only place that could not be
read that way. All time stays the default because the common question is *what
did I dictate* and only the follow-up is *when*, and the month list is read off
the whole returned set so that choosing June does not leave June as the only
month there has ever been.

It is the FIRST control on the toolbar and it is always drawn — including on a
record that spans one month, where it holds `All time` and that month and asks a
question with one answer. First because it is the coarsest of the three: you pick
a stretch of time, then search inside it. Always because a control that appears
the day a record crosses a month boundary is a control nobody learns is there,
and because on any record it states what the list is scoped to, which is the
first thing a reader coming back after a year needs to know.

**The toolbar reads in three groups**: which records (month, search, status),
what a row shows and how many (the text segment, the page size), what to do with
the set (export, open the folder, the retention rules). Its label follows —
`Filters` was already wrong for the text segment and would have been a lie with
two more non-filters on it.

**The recital is gone and the doors are controls.** `Open folder` calls
`reveal_transcript_in_file_manager` with no path, which is the runtime's own way
of saying *the directory itself* and creates it first on a machine that has not
dictated yet. `Retention rules` opens Privacy & Data, which is where the two
numbers the sentence quoted can actually be changed — as a SECTION and not a
view, which is the distinction the first build of this button got wrong and paid
for silently: `privacy` is a pane of the settings sheet, `ViewId` is the four
workspace views, and `open` refuses an id neither list knows rather than
guessing. A press that goes nowhere and reports nothing is the worst shape a door
can have. What remains at the foot is the one line that was never standing: what
an export just did.

**The count over the list goes with it.** The pager says `26–50 of 60`, which is
the same figure with the reader's position added, on the control they are already
looking at.

## Consequences

- A history of one page has no count anywhere. That is the trade the owner asked
  for, and the empty record still says so in words rather than as a nought.
- The month filter narrows in the browser while search and status narrow in the
  runtime. The inconsistency is deliberate and bounded: the runtime's query has
  no month field, and adding one would let the month list and the list itself
  disagree about which months exist.
- **The list still cannot show a record the index no longer holds.** History
  reads `history.json`, which is pruned by age and by count; the Markdown files
  outlive it in their folders. *Every transcription ever* is therefore bounded by
  the retention rule — which is the rule the new button opens, and the honest
  place to raise it.
- The transcripts folder itself is still not settable. `transcripts_dir()`
  follows `WORDSCRIPT_DATA_DIR` and nothing in the UI, so no control claims
  otherwise.
