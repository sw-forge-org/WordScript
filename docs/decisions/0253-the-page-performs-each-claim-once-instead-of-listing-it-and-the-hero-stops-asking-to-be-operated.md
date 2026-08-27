# 0253 - The page performs each claim once instead of listing it, and the hero stops asking to be operated

Date: 2026-08-26
Status: **Accepted.** Third decision covering `web/`. It reverses decision 3 of
ADR 0252 and keeps the rule that decision was derived from. ADR 0251's port
contract is untouched: the computed-style diff still describes how the port was
accepted, and nothing here re-opens it.

## Context

A review of the built page against a running app produced six findings. Five
are surfaces and one is a number, and they have a single shape in common: on
every one of them the page was **describing** a claim it could have been
**making**, and paying for the description in reader effort.

### The learned tab printed a word the app does not print

The capsule on the page grew a tab reading `learned backfill`, with `learned`
set muted and the word set in the accent. The shipped tab
(`.ov-learned-tab` in `src/styles/overlay-pill.css`, built by `activeNudge` in
`src/windows/OverlayWindow.tsx`) is an accent dot beside one line of plain
text, and its text is the word alone -- `word`, or `word +N` when a dictation
taught more than one. The verb lives in the `title` and the `aria-label`, as
`Learned: a, b`, and has never been on screen.

This is the smallest of the six and the one that mattered most, for a reason
that is not about the tab. The capsule is the only part of the app the page
draws at full fidelity, and it is the part a reader is most likely to meet
again in a screenshot, in a recording, or on their own machine. A capsule that
differs from the shipped one is not a styling choice; it is the page teaching
a surface that does not exist.

### The hero asked the reader to hold a key, and the reader would not

ADR 0252 decision 3 made the hero an instrument: it played once, parked in
`mode-picker`, and then waited for a held pointer or space bar, running a
capture as long as the hold. The rule behind it stands -- a surface that
invites a press has to answer one. The instrument built on top of it does not.

Three things were reported about it and all three are structural rather than
polish:

- **The gesture is not discoverable.** Hold-to-talk is the product's own
  gesture and it is learned inside the product, on a keyboard chord, after
  onboarding has named it. A first-time reader on a marketing page has none of
  that. What they have is a rectangle with a capsule under it.
- **It breaks off.** The runtime's capture length is the hold length, so a
  reader who holds for 300 ms is answered with the `error` state. That is
  faithful, and it is the wrong first impression: a reader who has never seen
  the product working reads a failure as the page being broken, not as the
  product having an error path.
- **The hero is the one surface that has to work without being worked.** It is
  the first object on the page and the only evidence a reader has that the
  thing is real before they have decided to care. Making that evidence
  conditional on performing an unfamiliar gesture spends the one moment where
  the reader has not yet agreed to spend anything.

### `Where your words go` had a control for every axis and a rhythm for none

The section carried three tab buttons, a seven-button mode strip, two delivery
cards, a rules block and three multi-sentence leads, stacked with no spacing
that distinguished them. Every axis of the demo had its own control and the
controls did not read as a hierarchy, so the surface asked to be studied before
it could be operated.

The mode strip was the expensive one. Seven buttons is the product's mode list
transcribed into UI, and the product does not offer that UI: it changes modes
on a per-mode key, on the picker key, or by pressing the mode chip on the
capsule, which is a button with a `tap to cycle` title. The page drew a control
the app does not have, next to a capsule carrying the control it does.

### The activity field's tooltip omitted two of the four things a day holds

The field answered a hover with the day, the count, the words and two clocks.
`ActivityCalendar` answers with meetings and uploads as well, and the product
records both. The page had built the hover, then under-reported the day.

### The turnaround figure was not the one the runtime measures

The tile read 1.9 s. The measurements in ADR 0247 and ADR 0248 put the current
figure near a second. A page whose whole argument is that its numbers are read
off a real disk cannot carry a figure a second slower than the product it is
selling.

Worse, the four tiles were four independent literals. `Words per minute`,
`Time saved`, `Turnaround` and `Languages` were unrelated numbers under a line
claiming they came from the field above them, which they did not.

### The engine section drew three lanes where the product has four

Eight jobs by three lanes, twenty-four cells, a default model id in each. Two
defects, and they are the same defect from two sides:

- **A matrix is the most complete statement of the claim and the least
  readable one.** The claim is that the jobs do not have to agree. A grid only
  says that once a reader compares it against itself, and what a reader takes
  from twenty-four mono strings is that there are a lot of models. The four
  cells reading `none` -- the only content anybody could act on -- were the
  quietest text on the surface.
- **The fourth lane was missing.** The product has Cloud, Local, Your server
  and Enterprise (`docs/PROVIDERS.md`, and `LANE_LABEL` in
  `src/screens/data.ts`). The grid had three, because it was generated from the
  catalogue's `lanes` block and the fourth lane is the one with no catalogue
  rows in it -- by construction, since the server is the reader's and its model
  list belongs to whoever runs it. A reader who already operates a box read the
  section and found the product does not serve them.

## Decision

### 1. A capsule that differs from the shipped capsule is a defect

The page's capsule is rebuilt against `src/styles/overlay-pill.css` and driven
through the runtime's own `levelToBars` curve. The learned tab now joins that:
one accent dot, the word alone, the verb in the `title` and the `aria-label`,
and the geometry copied value for value -- 22 px tall, anchored at
`right: calc(100% + 6px)`, inner pinned right at `max-width: 168px`,
`10.5px/500` at `letter-spacing: .01em`, border `rgba(232,145,42,.34)`, which is
the app's `--ov-accent-border`.

The hold is 3660 ms, which with the shutter's two ramps is the runtime's own
`LEARNED_NUDGE_DURATION_MS` of 4 s spent the same way.

The rule this states, for anything the page draws next: **the capsule is not a
component the site owns.** It is the app's surface reproduced, and a difference
in it is reported and fixed rather than justified.

### 2. The hero plays. It does not ask. (Reverses ADR 0252 decision 3.)

The hero is an autoplay loop. Each pass parks in `mode-picker`, records,
processes, delivers, and where the scene taught the runtime a word, grows the
learned tab; then it advances to the next mode and runs again. It starts and
stops on an IntersectionObserver at 0.25, so it costs nothing off screen, and
under reduced motion it prints its settled reading and never starts.

**The mode chip stays pressable, and pressing it advances the loop.** That is
what keeps ADR 0252 decision 3's rule intact rather than discarded: the hero no
longer invites a press it cannot answer well, and the one control it still
offers is the app's own, does what the app's does, and answers immediately.

What is given up is the reader's ability to control capture length in the hero,
along with the `error` state, which now has no scene anywhere on the page. That
is a real loss and it is the right trade: the error path is a thing to
demonstrate to somebody who already believes the product works, and the hero is
addressed to somebody who does not yet.

### 3. One mode control, and it is the gesture the app has

The seven-button strip is gone. The mode changes in two places, both of which
resolve to the same call:

- **The chip on the capsule**, which is the app's own gesture and is drawn on
  the compact states.
- **One button under the window**, naming the current mode, its key, and that
  it is one of seven. It exists because the chip is absent on `result-actions`
  and under reduced motion, and a control that is only reachable in some states
  is not reachable by a keyboard reader at all.

Delivery stays a two-button segment, because `auto_paste` and `clipboard_only`
are a choice between two named things rather than a cycle, and because the two
endings are the section's argument.

The leads are one sentence each and the block carries a rhythm: the control row
sits tight under the window, the sentence describing the delivery sits tight
under the control row, and the rules block is separated by a rule and real
space. The section lost 61 px, the seven-button strip, the two delivery cards, and
every sentence after the first in each of its three leads.

### 4. The four figures are one arithmetic, and the field reports what a day holds

Every value in the numbers block is now computed from the same 364-day array
the field above it draws, using the runtime's own formulas:

- the rate is a median with its denominator named in the foot, and it is the
  divisor that turns each day's word count into that day's seconds, so the
  field and the tile cannot disagree;
- `Time saved` is `ledgerTimeSaved`'s formula over `SAVED_WINDOW_DAYS`, which
  is 4 weeks, with the baseline in the foot because ADR 0182 says the baseline
  is not context about that reading, it is the reading;
- `Turnaround` is 0.9 s;
- `Languages` names the share and the denominator it was measured on, so a
  bilingual reader is not told they speak one language (ADR 0186).

The tooltip carries meetings and uploads on the days that have them. The site
carries them without the Developer Mode tag production uses, per ADR 0252
decision 1: there are no readiness labels on this page.

The section's own claim -- that these are read off one file -- is now true of
the block making it.

### 5. Four lane cards and one worked profile, instead of a grid

The matrix is replaced by two objects that between them carry the same
information and state the claim once:

- **Four cards, one per lane.** What the lane is, how many of the eight jobs it
  serves, who runs on it, and what it costs you to use -- which is the
  credential shape, and which is the fact that actually decides which lane
  somebody picks. Nobody has to read a model id to choose a lane. The
  `Your server` card draws the two fields it takes instead of a vendor row,
  because a row of logos there would assert a compatibility matrix nobody has
  measured.
- **One profile, four rows, three lanes.** Every model on it is the
  catalogue's own default for that `(lane, job)` pair, so it is not an
  illustration of what a profile could look like; it is what the runtime would
  do if you set those four.

One line above the cards names the eight jobs, which restores the grid's row
headers at a fraction of the height.

Naming `Self-hosted` in `web/src/lib/catalogue.ts` spells no model id, so
ADR 0115 is obeyed rather than bent: the rule is about model ids, and this
lane's whole character is that it has none.

### 6. The vendor marks come from the package the app already reads

`@lobehub/icons-static-svg`, MIT, the same package and the same version
`src/components/shell/brandSymbols.ts` uses. Read at build time, so nothing
ships but path data.

The mono variants, for two reasons. The page spends its colour budget on the
focus band under the hero, and a second coloured logo row four sections down
would turn a technical table into a partner wall. And the colour variants carry
gradients with internal `id`s while the same mark repeats on this page --
OpenAI on Cloud and on Local, Anthropic on Cloud and in the profile -- which
inline is duplicate ids in one document. The loader checks both properties
against the file rather than trusting them, and throws if a file it reads
carries either.

A vendor the mark set does not carry rides as its name beside a dim dot. **A
missing mark must never become a missing vendor**: dropping the glyph is a
rendering decision, dropping the vendor is a claim about the product.

## Consequences

### Measured after all six, at 1440x900 on the built output

- **Overflow**: none at 360, 390, 430, 620, 768, 900, 1024, 1080, 1280, 1440.
  `documentElement.scrollWidth` is the viewport less the scrollbar at every
  width. `.own__tip` joins `.focus__rail` and `.band` on the exclusion list: it
  is a `position: fixed` panel parked off-canvas while hidden, so it is counted
  by a naive walk and contributes nothing to the document's width.
- **Contrast**: 283 elements checked across the whole page in its settled
  state, 0 AA failures.
- **Reduced motion**: 28/28 reveals shown, SMIL paused by hand (25 animations,
  `animationsPaused()` true), the hero capsule settled on `result-actions`, all
  seven modes settled (six on Delivered, Auto on Routed), all three intakes
  settled (Delivered, Written, Answered), the diagram on `ws`.
- **Console**: 0 errors on the built page. Two hydration warnings were fixed
  along the way, described below.
- **Banned punctuation**: 0 em-dashes, 0 en-dashes, 0 middle dots, 0 curly
  quotes, in the sources and in the built HTML, CSS and JS. The only non-ASCII
  in the build is the German in the Translate scene's fixture.
- **Payload**: HTML 126.4 KB (27.9 gz), CSS 65.4 KB (13.4 gz), JS 233.8 KB
  (76.4 gz) across ten chunks, of which React is 179.7 KB (55.7 gz).

### The hydration warnings, and why they were real

Both islands root on a `.rise` element, and `.rise` is revealed by one observer
in `Base.astro` which adds `is-in` imperatively. Both are `client:visible`, so
by the time React hydrates, the served DOM already carries a class that is not
in the JSX -- a mismatch React reports and then leaves alone. The className is a
literal that never re-renders, so the reveal survives and the fix is to say the
difference is intended (`suppressHydrationWarning`) rather than to move the
reveal into React and end up with two mechanisms deciding one class.

### What this does not change

The port contract in ADR 0251 and the vision-page framing in ADR 0252 decisions
1, 2 and 4. Nothing on this page is a photograph, nothing carries a readiness
label, and every value it states is still the runtime's own.

### The check this leaves behind

The engine section is now generated entirely from `shared/model_catalogue.json`
plus one hand-written list of four lanes. A provider added to the catalogue
appears on a card without anybody editing the page; a **lane** added to the
product does not. That is the one place in the section where the page can go
stale silently, and it is written down here rather than left to be discovered.
