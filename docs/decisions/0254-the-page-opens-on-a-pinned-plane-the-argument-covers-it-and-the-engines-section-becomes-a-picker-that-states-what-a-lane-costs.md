# 0254 - The page opens on a pinned plane the argument covers, and the engines section becomes a picker that states what a lane costs

Date: 2026-08-26
Status: **Accepted.** Fourth decision covering `web/`, the product site at
wordscript.dev. It changes the page's opening structure, replaces the engines
section's four static cards with an operated picker, and adds two surfaces the
page did not have. ADR 0251's port contract still describes how the port was
accepted; nothing here re-opens it. ADR 0252's rule that every value on the
page is the runtime's, read rather than typed, is what most of this decision
spends its work obeying.

## Context

Three findings, from three different places.

### The opening had no moment and the argument had no beginning

Measured on the built page at 1440 by 900: the hero was 434px tall, the focus
band under it 130px, and the next section's heading sat at 626px. All three
were on screen at once, above a 900px fold. Everything was visible and nothing
was first.

That is not a spacing problem. A page that opens with a claim and then argues
it has two parts, and they were sharing one screen, so neither had a boundary.
The reader met "Speak once. It lands. It stays. It acts.", the capsule that
plays it, the row of windows it lands in, and the question "Where your words
go." as one undifferentiated surface.

### The engines section named four models out of thirty-five

`shared/model_catalogue.json` holds thirty-five rows. The section drew four
lane cards, a one-line list of the eight jobs, and a four-row profile block,
and between them they spelled four model ids. A reader deciding between lanes
could read the whole section and not learn what would run their dictation, what
it would cost to have on their disk, or which jobs a lane does not serve.

This is the second time that section has failed in a way that is about
arrangement rather than about data. It first drew an eight-by-three grid of
twenty-four model ids, which ADR 0252's review found to be the worst surface on
the page: what a reader takes from a wall of mono strings is "there are a lot of
models", which is not the section's claim, and the four cells reading `none`
were the only actionable thing on it and its quietest text. The cards that
replaced the grid fixed the wall by removing almost all of the information.

### Two questions decide a dictation download and the page answered neither

A review against a comparable product's landing page put two surfaces beside
ours that we had nothing to set against:

- **Language.** The page did not contain the word. The product has per-profile
  language and a language lock (`src/lib/textProfiles.ts`), a translate job with
  a target language, a detector that measures the language of delivered text
  (`src-tauri/src/core/language_detect.rs`, ADR 0180), and a catalogue that
  carries a `languages` field per row with a source and a read date. None of it
  reached the site.
- **Offline.** The Local lane's credential line has always read "none, by
  construction", which is the fact. The word a reader scans for is "offline",
  and it was nowhere on the page.

## Decision

### 1. The page opens on a pinned plane and the argument covers it

The hero and the focus band are one plane, pinned at the top of the viewport at
`100svh`. Everything from "Where your words go." down is a second plane with its
own ground that scrolls up over the first.

**It is `position: sticky` and an opaque box, and nothing else.** No
ScrollTrigger, no transform, no scroll listener. It works before script
arrives, with script disabled, and under `prefers-reduced-motion` — because it
is not motion. Nothing animates; one box stops while the box after it keeps
going. This was verified against the built page before it was written: a sticky
probe in `main` holds at `top: 0` through a 1500px scroll, so
`body { overflow-x: hidden }` — which the ASCII band needs — does not cost
sticky here.

**`100svh`, not `100vh`, and `min-height`, not `height`.** `vh` is the large
viewport, so a hero sized in it is taller than a phone screen before the address
bar retracts. `min-height` because a narrow screen may need more than a viewport
for the same content, and content that overflows a fixed height is cut off.

**Under 640px of viewport height it does not pin at all.** A sticky box taller
than the viewport pins its top and then hangs: the reader scrolls and the bottom
of the hero never arrives. That is a phone in landscape, and it is the one case
where the effect costs the reader something rather than merely not paying. Under
the guard the page is what it was, two boxes one after the other. Measured at
844 by 390: `position: relative`, and the plane scrolls away normally.

**What is on which plane is not a layout detail.** The hero and the focus band
are one claim — it lands in the window you already had open, and here are the
windows. Splitting them would put the evidence on the cover and the claim
underneath it.

### 2. The ground is a ruled sheet with one lamp on it, and the dark planes carry it too

The pinned plane steps down to `--bg-inset` and is ruled at 26px — the lede's
own line box, since `--t-lead` is 16px at 1.62. A warm radial light is washed
over it and the rules are masked by that same light, so they exist only where it
falls.

**The motif is ruled paper because of what the product is.** A dictation app
that keeps what you said as a file in a folder you named is a writing surface
before it is a piece of software. A dot grid is what every developer tool ships
this year and it means nothing.

**The lamp is why it reads at all, and that is a measured finding rather than a
preference.** Four candidates were rendered and compared. Flat rules were
tasteful and invisible. The candidate that beat them was a cell grid with a warm
radial light behind the heading — and against the ruled version the grid was not
what won it, because the grid was almost as faint. The light was. So the light
was kept and the grid was dropped: the generic half of that candidate was doing
none of the work.

**There is no margin rule.** The sheet carried one for a while, a hairline down
the left margin in the accent, which is what makes ruled paper read as paper.
On a page whose only accent is the primary action and one italic in the heading,
a second accent line running the full height of the opening plane is a third
thing competing for the same eye.

**The rules surface again on every dark plane** — the turn, the numbers, and now
the close. The ground the page is written on does not change halfway down it. A
texture that appears once in the hero is an ornament on the hero; the same
texture surfacing wherever the page steps down to its darkest plane is the page
having a ground. Those planes take no second lamp: they are full of drawn
objects, each already lit by its own shadow, and the material rule in
`globals.css` says a glow on everything says nothing.

**The closing section becomes a dark plane.** It was the only one of the three
places the page asks the reader to stop that was drawn on the ordinary ground,
which read as the page trailing off rather than closing.

### 3. The lanes become a picker, and every row states what would run

Four radios, four labels, four panels, `:checked ~` — no JavaScript. One lane's
eight jobs on screen at a time, and the reader opened that lane.

**This is not the matrix coming back, and the difference is who asked.** The
grid drew all twenty-four cells at once. These are the same values arranged so
that a matrix does not have to be compared with itself before it says anything.
A wall nobody opened is a wall; a column somebody opened is an answer to the
question they asked by choosing. The rows that do not run stop being the
quietest text on a grid and become the visible shape of the lane just opened.

**A radio group is what a one-of-four choice is.** The keyboard works, the
labels are hit targets, the state survives with script disabled, and a screen
reader is told it is a choice rather than being handed four buttons that
mysteriously change a panel.

**The download size is on the Local rows and nowhere else.** It is the deciding
fact on exactly one lane: a cloud model costs a request, a local model costs
disk and a load before it costs anything else. It is `install.size_bytes` from
the same rows `core::model_install` fetches by, formatted by the rule
`formatModelSize` in `src/lib/modelCatalogue.ts` uses, so the number on the site
and the number the download costs cannot disagree.

**The panel is as tall as the lane that is open.** The first attempt stacked all
four in one grid cell to keep the height fixed, and paid for it with a
four-hundred-pixel hole under Your server, which has three lines of content
against Cloud's eight rows. That is not a stable layout, it is one lane's
emptiness printed at the size of another lane's content.

**Your server draws no rows and the absence is the lane.** Its model list
belongs to whoever runs the server. Eight rows of the same sentence would be a
wall that says less than the sentence does once, so it draws the two fields it
actually takes and then names the eight jobs as an axis: all of them, on
whatever you are running.

### 4. Two cards under the picker: language, and offline

**Language states two numbers and they are different numbers on purpose.** What
the recogniser transcribes is a property of Whisper and comes off the catalogue
rows that state it. What WordScript can name afterwards is the detector's own
table and is smaller. Both are read: the first out of
`shared/model_catalogue.json`, the second out of the declared length of
`ISO_639_1` in `src-tauri/src/core/language_detect.rs`.

**A third figure reading `0 guessed` was drawn and then removed, and the
removal is the more useful half of this decision.** The behaviour it named is
real: under `MIN_WORDS` of text, or where the reading is unreliable, a run is
counted in no language at all rather than folded into a near neighbour. The
argument for printing it was that every product in this category states a
language count and none of them says what happens when it does not know.

The argument is wrong about who is reading. Nobody arrives at a language card
wondering whether the product guesses, so the row answers an accusation that was
never made — and a product volunteering what it does not do reads as one with
something to be defensive about. A zero is also the hardest figure to place: it
has no unit a reader can hold, and next to two counts it invites the reading
that something is missing. The behaviour is unchanged and its derivation stays
in ADR 0180 and in the Rust file's header, which is where a reader who wants it
will look.

**What the card claims instead is the thing the reader can act on.** Language is
read off the delivered text rather than off a setting, so nothing has to be
chosen first and nothing has to be set back — which makes switching language
mid-paragraph a non-event rather than a feature. That is the heading, and the
two figures are its evidence rather than its subject.

**The chips carry a flag and an endonym, and the flag is admitted to be a
convention.** Spanish is not Spain and English is not the United States. It is
drawn anyway because the row exists for a reader scanning for their own language
and finding it in under a second, which is what a flag does and a two-letter
code does not. The honest way to do a dishonest convention is to say so, keep
the mapping in one commented place, and never let the flag be the only
identification: the name beside it is the actual answer, it is the language's own
name for itself, and it is read from ICU rather than transliterated by hand.
Every code is checked against the detector's parsed table and throws if it is
not there — the page must not name a language the product cannot name back.

**Offline says one word the page had never said.** It is not a fifth lane and
not a mode; it is what the Local lane already is, stated in the words somebody
searches with.

**And it states the one thing offline actually costs: 7.3 GB.** The card lists
what the Local lane does not cost -- no key, no request -- and then closes on
the price, deduped by model and read from `install.size_bytes`. That total
cannot be got from the picker above it by adding the visible rows: eight jobs
resolve to four files, two of which are shared across jobs, so summing the rows
would report nearly double. The catalogue module throws on a local default with
no install block, because a lane total missing one of its models is not a
smaller number, it is a wrong one. This replaces a row that read "priced in
disk" and pointed upward, which asked the reader to do the arithmetic that the
dedupe exists to get right.

**A local-versus-cloud toggle diagram was considered for this card and
rejected.** A comparable product draws one: nodes for the external services,
wires with travelling dots, a switch that greys the nodes and dashes the wires.
It is a good drawing and the page is not going to have it, because the page
already owns that grammar twice. `#turn` is a two-state toggle whose wires draw
and undraw with dots arriving on a shared beat, and the lane picker directly
above this card is the same local-versus-cloud comparison already operated by
the reader, per job. A third two-state graphic would be the page repeating its
own trick rather than making a third argument, which is what ADR 0253 forbids.
The claim this card owns that neither of those makes is what going offline
costs, and a figure states that better than a diagram can.

### 5. The vendor marks are in colour, four of them are not, and they ship as a sprite

The marks module drew the mono variant of everything, for a design reason and a
mechanical one.

The design reason was that a lane row wants a set rather than a parade. The
section it was written for no longer exists. In a picker somebody operates, a
vendor's own colours are what makes a row findable at a glance instead of
readable at a stop, and the page's two coloured runs now do two different jobs:
the focus band is a claim about where text lands, this is a control.

The mechanical reason is answered rather than overruled. Coloured variants carry
gradients and masks with internal ids; the page draws the same mark up to
thirty-six times, and across marks the package reuses `a` and `b` — so Gemma's
gradient would have resolved to Qwen's. Every mark is now defined once as a
`<symbol>` with its ids namespaced by slug, and every use site is a `<use>`.
Verified on the built page: eleven symbols, thirty-six uses, zero duplicate ids
in the document.

**Four vendors have no coloured variant and that is not a gap.** Groq, OpenAI,
Anthropic and Ollama ship one file each because their marks are monochrome by
design. Those keep `currentColor`. Inventing a colour for them would be drawing
a logo that does not exist.

### 6. LinkedIn joins the footer's left group, and there is no X

The left half of the footer is the project and the house it is built in. The
company's page belongs there, ordered nearest-to-the-code first.

There is no X link and there will not be one. The account exists and belongs to
the maintainer rather than to SW labs, so a link would point a reader looking
for the company at a person. A row of social marks is not the goal; the two
places this project answers in are the room and the repository, and both are
already named.

## Consequences

- The fold now shows the hero alone. That is the intent, and it is the change a
  reader notices first.
- `web/` gains one dependency, `circle-flags` (MIT), read at build time and
  inlined. `npm audit` reports zero vulnerabilities.
- `src/lib/svgIds.ts` is new and is shared by the marks and the flags: both
  packages ship files with colliding internal ids, and both go through one
  namespacing pass that throws rather than passing a file it did not understand.
- `src/lib/languages.ts` parses a Rust source file at build time. That is a real
  dependency on another language's file shape, and it is why every pattern in it
  throws on a miss: a page whose promise is that the number is the runtime's
  cannot render with a number that is merely plausible. The parse is a `?raw`
  import rather than `readFileSync` — the first attempt read the right file in
  dev and the wrong one in a build, because Astro bundles the module and
  `import.meta.url` follows it into `dist/.prerender/chunks/`.
- Checked at 320, 390, 844 by 390, 1440 and 1920: no horizontal page scroll at
  any of them, and the pin guard behaves as designed at the short viewport.

## Not decided here

Sub-pages per feature, and rendered video in place of the page's CSS
demonstrations. Both were raised and both were deferred: the sub-pages are their
own round of work, and the existing demonstrations are coupled to the runtime's
own state model (ADR 0252), which a video would lose.
