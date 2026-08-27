# 0255 - A disk figure states both ends because the site cannot predict an install, and the phone gets the navigation the page had been hiding from it

Date: 2026-08-26
Status: **Accepted.** Fifth decision covering `web/`, the product site at
wordscript.dev. It corrects one figure ADR 0254 introduced the same day,
separates two cards that were drawn as one object, and does the mobile pass
that the pinned-plane work in 0254 left undone. ADR 0252's rule that every
value on the page is the runtime's, read rather than typed, is what the first
correction is about; ADR 0253's rule that the page performs each claim once is
what the last section leans on.

## Context

### A figure was arithmetically correct and described a machine nobody has

ADR 0254 gave the offline card a single number: the sum of every distinct file
behind the Local lane's eight defaults, `7.3 GB`, deduped by model because the
eight jobs resolve to four files.

The arithmetic was right and the claim was wrong. Nothing in `web/` knows which
models somebody installs. The catalogue holds a default per job per lane; an
install is a decision the reader has not made yet. A reader who only ever
dictates fetches one speech model and never sees the other three, and the card
told them they owed seven gigabytes for a job that costs a hundred and fifty
megabytes.

This is the same defect class as a language count nobody measured, one step
further along, and it is worth naming precisely because it passes every check
the rest of the page runs. The value was read rather than typed. It was sourced
from `install.size_bytes` on the same rows `core::model_install` fetches by. It
would have thrown rather than rounding down. **A number can satisfy every rule
about where it came from and still be a claim about a machine that does not
exist.** Provenance is a check on the value, not on the sentence around it.

### Two cards were drawn as one object with a seam down it

`.eng__two` was a single bordered box with a 1px gap over a border-coloured
ground — the standard drawing for one thing with two halves. A reader meeting it
has to work out whether the seam means *versus*, *before and after*, or nothing.
It means nothing: language and offline are two independent answers to two
independent questions, which is exactly why they are not columns in the picker
above them.

### The phone had no navigation, and had not had any for a while

Below 680px both header links were `display:none`. Four items do not fit one
row and the action is the one that survives, which is correct triage — and it
left a phone with no way to reach any part of a ten-thousand-pixel page except
by scrolling all of it. The list was never right either: the header named the
first two sections because two were what fit, not because those two were the
destinations.

A pass over every section at 390 by 844 found four more things, all of them
invisible at desk width:

- The activity field rendered its year at **4.3px per cell, 39px tall**. Fifty-two
  columns of `1fr` inside 298px. Present, unreadable, impossible to touch.
- The footer's project group wrapped four items onto one line and dropped the
  fifth onto a second, which reads as a separate group rather than as a row
  that ran out of space.
- `#turn` had no `scroll-margin-top` — it was not a link target until this
  round made it one.
- The turn's lede read `their own product.WordScript keeps it`. Astro collapses
  the newline between a closing tag and the next word to nothing rather than to
  a space, and it had been shipping that way on every viewport.

## Decision

### 1. The disk figure states both ends, and the spread is the argument

Two rows, not one:

- **The floor** is the single file behind the `dictation` default — what
  somebody who only dictates ever fetches, and a working install.
- **The ceiling** is every distinct file behind all eight defaults, deduped,
  which is what running the whole lane locally costs.

**The spread is the section's own argument restated.** The paragraph at the top
of the section says a profile decides each job separately. One number
contradicts that paragraph; two numbers with the condition on each are the same
sentence in figures.

**The ceiling stays deduped and that is not a detail.** Eight jobs resolve to
four files, two of them shared across jobs. Summing the visible rows in the
picker reports roughly triple, so a reader who adds them up gets a different
answer than the card gives — which is why the card says what it counted.

`catalogue.ts` still throws on a local default with no install block. A total
missing one of its models is not a smaller number, it is a wrong one.

### 2. Two cards are two cards

Each takes its own border, radius and shadow, and the gap between them is the
gap the page puts between sibling cards everywhere else.

**Both figure blocks are now the same object, so one rule draws them.** The
language card's two counts and the offline card's two sizes are the same shape —
a figure and the condition it holds under — and two cards answering two
questions with the same kind of evidence should not invent two treatments for
it. The offline column is wider because `148 MB` is wider than `99+`.

### 3. The phone gets a menu, and it is drawn on the page's own ground

Six entries in page order, in a panel that covers the page: how it works, the
turn, numbers, what you get, engines, questions. The burger sits to the **right
of the action**, because the action is what the header exists to offer and the
menu is how you get past it.

**The first version of this panel was a copy and was rejected on sight.** It was
built against a reference: a flat dark plane, big labels stacked with hairline
dividers, a chevron at the end of each row, one full-width accent slab at the
foot. Every one of those is the default shape of a phone menu, and together they
were not merely generic -- they were recognisably that particular reference,
which is a worse outcome than generic. It is the same failure the ground of the
opening plane already had once, recorded in ADR 0254: the candidate that read
as having character turned out to be carrying a grid every developer tool ships
this year, and what actually won was the light.

So the panel is drawn out of what this page already owns:

- **The ruled sheet and its lamp**, ADR 0254's ground, at the panel's scale.
  The page has one ground and one warm light; the screen that covers everything
  should be on that ground rather than introduce a second one. The rules run
  behind the list instead of between its rows, because hairline dividers under
  each item would be a second horizontal rhythm crossing the first, and a ruled
  sheet already separates what is written on it.
- **The light sits behind the list, not under it.** Placing it low is what the
  reference does, and on a panel whose list ends halfway down the screen it
  lights the empty half: the texture was brightest in the void and faintest
  under the words. At the list's own height, both the rules and the warmth fall
  away below it, so the bottom of the panel is quiet and the action is the only
  thing standing in it.
- **A mono ordinal instead of a chevron.** `01` to `06` at micro size, muted,
  taking the accent on the row being pressed -- which is exactly what the demo's
  three tabs do with `01 Cursor`, `02 Context`, `03 Agent`. It is the page's own
  way of listing, and it says the page is read in order, which after the pinned
  opening is what the structure is claiming. The chevron said only "this is a
  link", which a row says by being one.
- **The page's own pair of actions**, primary then ghost, the same two the hero
  and the closing section end on. A single full-width accent block was
  inventing a third call to action for a page that has one.

**It is a script and the lane picker is not, and the difference is not
consistency, it is capability.** A radio group is what a one-of-four choice is,
which is why the picker ships no JavaScript. A checkbox toggle cannot close
itself when a link inside it is followed, so the reader lands on the section
with the panel still over it; it cannot lock the page behind it, so the
document slides under the overlay; and it answers no key. All three are
required of a surface that covers the page, and none is optional.

Focus moves to the **panel**, not to its first control. Moving focus onto a
button programmatically paints a focus ring on it, so a reader who opened the
menu with a thumb would see a ring around the close button — the one thing they
did not ask for. `tabindex="-1"` takes focus without becoming a tab stop, and
the next Tab reaches the first link, which is where a keyboard wanted to be.

**The panel is a sibling of the header, not a child.** `.top__in` takes a
`backdrop-filter` once the page is scrolled, and a filtered element becomes the
containing block for every fixed descendant. Inside it, the panel would have
been fixed to a 48px header rather than to the viewport.

**It closes on a crossing of the breakpoint too.** A phone rotated into
landscape passes 681px, where the button that opened the panel is gone; without
that listener the panel stays over a page whose bar is back.

### 4. The footer's four links take marks, and three of them are the vendor's

The row was four words in a line at 11px, which is a row a reader parses rather
than scans.

**The whole row moved onto one package to get LinkedIn's real mark.** The first
version read GitHub and Discord out of `simple-icons` and drew the other two by
hand, because LinkedIn is not in `simple-icons` — it was removed over the
trademark, the same way Windows was, and ADR-era practice in `osMarks.ts` is
that this project does not paste vendor artwork in from a third party to work
around a removal. That trade was wrong for this row: a group of four brand links
where two carry the brand and two carry an abstraction reads as two of them
being less real, and the one that had lost its mark was the company's own page.
`bootstrap-icons` ships all four under MIT, which is a licence to use the
artwork rather than a copy of it found somewhere.

One package means one licence, one 16-unit grid, one weight, and no per-mark
alignment to negotiate. `simple-icons` stays where it already was, in
`osMarks.ts`, for the desktops and the copyleft ring.

**SW labs takes a globe and that is still not a logo.** It is the only one of
the four with no mark to license: what exists in this repository is a wordmark,
and a wordmark reduced to a 14px square is a smudge — the same measurement
`osMarks.ts` made when it rejected the GNU head for the licence.

**Every mark keeps its own viewBox, read out of the file.** They are all 16
today, and a row drawn on a number typed into the module would be wrong the day
one of them is not.

### 5. The footer on a phone is a grid, not a wrapping row

The problem was wrapping, not width: where a `flex-wrap` row breaks is a
function of the label lengths, so adding a mark to each of four items moved the
break. Under 560px the licence takes its own line — it is a fact rather than a
destination, and the only item in the group that is not a link — and the four
links are a two-column grid that fits every label and cannot re-break itself
when one changes.

### 6. The year gets its own scroll axis rather than being thinned

At 390px the activity field is a scroller at 11px per cell instead of a
full-width grid at 4.3px. **The year is not cut down to fit.** Dropping half of
it would make the surface lie about how much it holds, which is the one thing a
field of real records must not do; putting it on its own axis is what a
contribution graph does on a phone everywhere else. `.own__field` takes
`min-width: 0` because it is a grid item, and a grid item's automatic minimum is
its content — without it the card sizes itself to the 649px inside and gets
clipped by its own section, which looks like a broken card rather than a
scrollable field.

## Consequences

- `web/` gains one dependency, `bootstrap-icons` (MIT), read at build time and
  inlined. `npm audit` reports zero vulnerabilities.
- `src/lib/linkMarks.ts` is new. It throws if a glyph loses its single-path
  shape, because this module draws only the first path and a mark quietly
  missing half of itself is not something anyone would notice.
- The page ships one more piece of chrome script, in the block that already
  owns the sticky header and the reveal observer. No new island.
- Verified at 390, 560, 640, 680, 860, 1440: the burger appears exactly where
  the ghost links disappear, the panel opens, locks the body, closes on a link,
  on Escape and on crossing back over the breakpoint, and returns focus to the
  button. No element on the page overflows its container at 390 except the
  focus marquee, which is a marquee, and the activity field, which is a
  scroller.
- **A landscape phone is the case that broke the panel and it is measured.** The
  breakpoint is a width, so at 640 by 360 the burger is still on the bar, and
  six rows plus the header plus the action came to 499px against 360 of
  viewport -- the action sat 139px below a fold that could not be scrolled to.
  The panel scrolls now, which is the guarantee that nothing is unreachable,
  and under 560px of height the list yields enough that on the common short
  case nothing has to be scrolled for: measured at 640 by 360, the action's
  bottom edge lands at 355.

## Not decided here

Whether the activity field's reading should say something other than "hover a
day" on a touch device. It is one line of shared copy, the panel does open on
tap, and changing the sentence per input type is a second surface to keep in
sync for a word.
