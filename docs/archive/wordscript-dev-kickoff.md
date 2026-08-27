# wordscript.dev - kick-off for the next session

Read this whole file before touching anything. It carries what has been
decided, what has been rejected, and what is measured, so none of it has to be
rediscovered.

---

## 1. What this is

A single marketing page for WordScript at `web/`, to be deployed later to
Cloudflare Workers on **wordscript.dev**. It presents the product **as
envisioned**, not as currently wired. There is no download link and no release
date; where a download would be, there is a choice to take part via Discord or
GitHub.

Files, all untracked, nothing committed, nothing deployed:

```
web/index.html   the page
web/site.css     the stylesheet
web/site.js      the live capsule engine, the three demo sequences, the ASCII surfaces
web/fonts/       6 self-hosted woff2, 182 KB total
web/PRODUCT.md   STALE - written against a positioning that was later rejected
web/REFERENCES.md STALE - same
```

`wordscript.dev` has Cloudflare nameservers but no A/AAAA record; the host does
not resolve. No scaffold, no build step, no deployment exists yet. The page is
plain HTML/CSS/JS on purpose so the design can be settled before the Astro
work starts.

---

## 2. The positioning, and why

From `docs/VISION.md`, which is the authority: *the voice is the input, what
stays is context, the output is the cursor, an object, or an agent.* VISION.md
also states outright that transcription accuracy is commoditising, so any pitch
built on "it transcribes honestly" argues the losing half.

The page is built on an equally weighted triangle - **Cursor, Context, Agent** -
which the owner confirmed. The differentiator is ADR 0046: WordScript does not
build a connector layer. Context is written into a directory the user's own
tools already open, rather than living inside the product. The agent channel is
the *proof* of that claim, not the spearhead.

Competitor, browsed live: **openwhispr.com**. MIT, local-first, already ships
meeting notes, folders, semantic search and cross-meeting chat. Privacy is a
tie. Speed is a tie. Do not position on either.

---

## 3. Rejected, settled, do not re-propose

- Six "direction card" HTML artifacts on invented worlds (court transcript,
  critical edition, plate section, galley proof, instrument panel, category
  standard). Deleted. All six were called AI slop in one message.
- Next.js App Router + OpenNext on Workers; Cloudflare Pages; a root npm
  workspace for the site; email signup at launch; a German locale or language
  switcher; `impeccable` as the design tool for this work.
- Positioning on speed, on "shows its work" alone, on "we accumulate context
  too", on privacy.
- **Every button a capsule.** This broke a rule in `docs/DESIGN_SYSTEM.md` and
  the owner named it unprompted. See §4.
- Eyebrow labels above headings (a small caps mono line with a dot). The owner
  called them an AI tell. All five are gone; do not reintroduce them.

---

## 4. The hard rules

**The design system is the app's, and it is adopted rather than
reinterpreted.** Read `docs/DESIGN_SYSTEM.md`, `src/styles/globals.css` and
`src/styles/shell.css` before changing any visual value. Already carried into
`site.css`:

- Ladder `#141416` / `#161617` / `#1c1c1e` / `#2e2e31` / `#3a3a3e`; foregrounds
  `#f2efe9` / `#c2bfb8` / `#9b9892`; accent `#ff9c2b`, `--on-accent` `#1c1c1e`.
- Radius ladder `--r-window` 10, `--r-card` 8, `--r-control` 6, `--r-small` 4,
  assigned by what a thing IS. **Capsules survive only where the object is
  physically a capsule.** The only capsule on this page is the overlay pill.
- `.ws-btn` material: 6px radius, `--bg-elevated` fill, 1px `--border`; primary
  is a vertical accent gradient with an inset white highlight.
- Seven type steps with the optical-size axis (`font-stretch` and tracking move
  per step).

**Two deliberate divergences, both commented in `site.css`.** The header uses
`backdrop-filter`, which ADR 0051 rules out for the app only because WebKitGTK
ignores it. The page carries one display serif (Zodiak) that the app has no use
for, because the app never has to introduce itself.

**The overlay capsule is live DOM, never a screenshot.** `mountPill()` in
`site.js` rebuilds it against the geometry in `src/styles/overlay-pill.css` -
40px tall, `width: max-content`, mic / bars / divider / mode / divider / timer -
and drives the bars through the runtime's own `levelToBars` curve
(`BAR_COUNT 11`, `MIN_BAR 5`, `MAX_BAR 30`). If the shipped pill moves, this
moves with it. The PNG crops that used to stand in for it were deleted.

**Never quote the owner** (repo rule). No blockquote, no italic span, no "in his
words", anywhere - and an example in code is constructed for its purpose, never
transcribed from a brief.

**No invented statistics, testimonials, logos or prices.** The four counters in
the Numbers section are labelled in the page as a constructed example of the
surface, not an average of anybody. Keep that label if you keep the numbers.

**No generic fonts**: no Inter, Roboto, Arial, Open Sans, system-ui.

---

## 5. Open feedback - this is the work

In the owner's order of emphasis.

1. ~~**The demo is not finished.**~~ **Done.** The three tabs stayed three,
   because the equally weighted triangle is confirmed positioning and must not
   grow into ten tabs. Each of the three gained a second axis instead, and
   every named feature landed inside one of them: Processing Modes, Draft and
   Translate-as-a-mode inside Cursor; Meetings and Import (files, YouTube,
   podcast) inside Context; the Orchestration Agent inside Agent. Auto sits
   last, behind the app's own subtab divider, because Auto is not a seventh way
   of writing but the decision about which of the six runs, and it is drawn as
   a router over three arriving dictations rather than as an eighth scene. The
   Translation *window* is not built as a fourth surface; it is stated in the
   Translate note as the same capability through a different door.

2. ~~**The emphasised words are smaller than the words they should stand out
   from.**~~ **Done, then reversed on review, and the reversal is the rule.**
   The first pass fixed the size and gave the hero's three verbs three
   different faces. The owner rejected that on sight: too many faces in one
   heading and too many emphasised words, and the heading itself too large and
   in the wrong face. The settled system is the inverse of what the page had.

   - **Archivo sets every heading.** It is the face the app is set in, and the
     heading sizes continue the app's own optical-size axis past `--t-hero`
     rather than starting a second one. `h1` dropped from a 40-72px serif to a
     33-48px Archivo; `h2` from 28-44px to 25-34px; `.turn p` moved to Archivo
     as well.
   - **Zodiak is held back entirely for emphasis, site-wide.** One rule, no
     per-word variants: italic, accent, `font-size:1.04em`. The 1.04 is
     measured, not chosen - these words are lowercase, so the x height is what
     reads as size, and Archivo's 0.530 over Zodiak italic's 0.510 is 1.039.
   - **One emphasised word in the hero, not three.** `Speak *once*.` carries
     the serif; the three verbs stay plain, which also keeps the triangle
     equally weighted instead of privileging one destination.
   - **Only the Zodiak italic is declared.** The roman and the bold became
     unreachable and their `@font-face` blocks are gone, so the one-face-one-job
     rule is enforced by the stylesheet. The files stay in `fonts/` undeleted.

   Related, from the same review: **the desktop hero is now two columns**, with
   the live capsule window beside the heading instead of under it, because the
   right half was empty. Below 1080px it stacks as before.

3. ~~**The background is still generic.**~~ **Decided and built.** The owner
   picked option B. The dot matrix is gone; the ground is a single paper grain
   at 5.5%, 128px tile, `stitchTiles="stitch"` so the seams do not print. The
   derivation stayed as a comment in `site.css`: the feeling is continuity, not
   freedom, so the ground is the desk the app already sits on rather than a
   surface to draw something new on.

4. ~~**The ASCII activity calendar is just random characters.**~~ **Answered
   twice. The second answer is the one that stands - see 12.2.** The first pass
   fed it this repository's real commit history and moved it under the closing
   heading. That was a true picture of the wrong subject: the field was never
   meant to be our commits, it was meant to be the app's own usage, counted the
   way a contribution graph counts. It is now the fifth figure in the numbers
   section and the repository history is gone from the page.

5. **The page still reads like generated copy, and needs a catcher.** Both
   rhetorically and in UI/UX. The owner's own suggestion: real-world elements -
   photography, organic material, grass was the word used - rather than another
   arrangement of panels. **Source these, and if you cannot, ask him for
   screenshots or assets.** He offered. Do not invent stock imagery and do not
   generate a photographic-looking asset and present it as real.

6. ~~**New, from the owner on 2026-08-26.** That speaking is genuinely faster
   than typing does not come through anywhere on the page.~~ **Built, then
   rebuilt - see 12.1 and 12.2.** The first pass put two cited measurements on
   the page. The second replaced them with three read in the order they were
   taken, because one of the two was measured on a phone and that objection is
   better answered than hidden. The app's own figures were staged in the same
   pass: they count up, and the usage field joined them as the fifth.

Item 5 is the only one of the six still unbuilt, because it needs assets nobody
but the owner can supply. §9 records what the first pass decided; §12 records
where the second pass overturned it, and §13 the third. **The latest section
wins where they disagree**, and §13 overturns §12 in one place: the hero is no
longer an instrument.

Two smaller ones already noted but not addressed: `web/PRODUCT.md` and
`web/REFERENCES.md` still describe the rejected positioning and need rewriting
against §2.

---

## 6. What is measured, so you do not re-measure it

Verified after the last change, at 1440x900 unless stated:

- **Overflow**: none at 360, 390, 430, 768, 900, 1024, 1080, 1280, 1440.
  `scrollWidth` stays under the viewport at every one. 900 was added because it
  is the wiring diagram's two-column breakpoint; 1080 is the hero's.
  **Read the audit correctly**: a naive walk reports about 80 to 110 overflowing
  elements at every width. They are all descendants of `.focus__rail` and of
  `.band`, both of which clip on purpose, and the marquee row is deliberately
  about 2.9 times the viewport wide. Exclude those two subtrees and the count is
  zero. Do not "fix" this. `.own__tip` joins them as of §13: it is a fixed panel
  parked off-canvas while hidden, so a naive walk reports it at every width and
  it contributes nothing to the document's width.
- **Contrast**: no AA failure, audited in the base state and in all three demo
  tabs. The four findings the previous pass left open are fixed: `--fg-muted` is
  a card-plane colour (4.71:1 on `--bg-card`, 3.94:1 once the ground lifts to
  `--bg-elevated`), so the selected tab subtitle, the current target row and the
  `you` message now step up to `--fg-dim` with their ground. The audit skips
  gradient-filled elements because it cannot composite them; the primary button
  is `#1c1c1e` on `#ff9c2b`, about 8.6:1, checked by hand.
- **Reduced motion**: complete. 22/22 reveals shown (`.rise.is-in`, not
  `.is-on`), all 7 modes land on Delivered or Routed with every rule on, all 3
  intakes land at 6/6 disk rows, the desk is settled at 7 terminal lines and 3
  messages, the hero capsule is at its end state. The three new surfaces:
  the wiring diagram lands on `data-state="ws"` with the count at 1, the focus
  marquee is one static half of 15 rather than the duplicated 30, and the
  commit field is drawn with its source line set.
  **SMIL does not honour the media query**, so `pauseAnimations()` is called on
  the diagram's SVG by hand. Verified via `animationsPaused()` returning true.
  If you add another `animateMotion`, it needs the same treatment.
- **All 7 modes reach their end state** in normal motion too: Delivered for the
  six concrete modes, Routed for Auto, rules 5/5, 2/2, 4/4, 3/3, 3/3, 3/3 and
  routes 3/3. Poll for `[data-step]` reading Delivered or Routed - a
  count-stability probe exits early during the typing phase and reports zeros.
- **Banned punctuation**: 0 em-dashes, 0 en-dashes, 0 middle dots, and 0 curly
  quotes, across all three files. Checked for the escaped forms too
  (`\u2019`, `\u2014`): a curly apostrophe written as an escape in a JS string
  is invisible to a grep for the character and reaches the page all the same.
  One was introduced and removed this session.
- **Payload**, re-measured 2026-08-26 after the five changes below:
  index 25.5 KB (7.1 gz), CSS 55.9 KB (13.9 gz), JS 66.9 KB (22.2 gz).
  Up from 16.6 / 45.9 / 48.5 raw. The JS carries the largest share of the
  growth: 9.3 KB of it is the 15 Simple Icons paths and 1.1 KB is the commit
  array, both of which are data rather than logic and both of which move to
  build-time generation in Astro. Fonts are unchanged at 139.8 KB over four
  faces: Archivo variable 88.0, Zodiak italic 22.9, Plex Mono 400 14.4 and
  500 14.5. Only Archivo and the Zodiak italic are preloaded, in that order.
- **Fonts fetched**: exactly four requests, one per declared face, no duplicate
  fetch behind the preloads. Chrome logs a preload-not-used warning for both
  preloaded faces; the single-fetch request log contradicts it and both faces
  render, so it is a timing heuristic and not a finding.

Three `impeccable` `layout-transition` findings stand and are deliberate:
`transition: height` on `.pill__bars .bar`, `transition: width` on
`.pill__learn`, and `transition: width` on `.tp__track i`. The first two are
copied from `overlay-pill.css`, where the width animation is load-bearing
against a WebKitGTK compositor bug. The third is the research timeline's bars.

All three are the same category and it is the one ADR 0252 decision 4 names: the
length **is** the quantity, so animating it is the animation stating its datum
rather than decorating with it. A composited substitute changes the drawing --
`scaleX` squashes the rounded cap to nothing at `--f: .084` -- and the cost it
would buy back is one transition per element, fired once on reveal, inside an
`overflow:hidden` track whose size the fill cannot affect. Leave all three.

No ignore is persisted for them: the only granularity the hook offers here is
file-scoped, and `site.css` is the project's one stylesheet, so that would be
`ignore-rule` under another name. The findings are meant to be read and
recognised, which is what this paragraph is for.

---

## 7. How to verify in this environment

A static server is already running; if it is not, start one from the repo root:

```
python3 -m http.server 8787 --bind 127.0.0.1
# then http://127.0.0.1:8787/web/index.html
```

**The browser caches `site.js` across `browser_navigate`, and it will cost you
an hour.** A query string on `index.html` does not bust the subresource, and
`fetch('site.js', {cache:'reload'})` returning the new text proves nothing about
what the page is executing. The symptom is an edit that is present in the served
file and absent in the running page, with no console error. The fix:

```js
const c = await page.context().newCDPSession(page);
await c.send('Network.setCacheDisabled', { cacheDisabled: true });
await page.reload({ waitUntil: 'load' });
```

`browser_run_code_unsafe` is the only tool that reaches this.

Playwright MCP quirks measured this session:

- `browser_take_screenshot` **without** a filename returns the image inline and
  works. **With** a `filename` it reports success and the file never lands.
- `browser_run_code_unsafe` is the only way to reach `page.emulateMedia`, which
  is how reduced motion was checked.
- Responsive sweeps are cheaper as same-origin iframes inside the loaded page
  than as repeated viewport resizes: one `browser_evaluate` covers five widths.
- The contrast audit must parse `color(srgb r g b / a)` as 0-1 floats and
  `rgb()` as 0-255, and must skip any element whose `backgroundImage` is not
  `none`.
- `impeccable detect.mjs` runs DEGRADED here (htmlparser2, css-select, css-tree
  and domutils are absent), so its findings are an undercount.
- Screenshots land in `<repo>/.playwright-mcp/page-<timestamp>.png`.

Repo rules that apply even though this is web work: never bypass the Husky
pre-commit hooks, and do not run heavy builds while an audio or capture
measurement is running.

---

## 8. Where to start

**Read §12 first, then §11.** The sketch was reviewed a second time on
2026-08-26 and six things changed; §12 is what the page looks like now, and it
overrides §9 wherever the two disagree. §11 is still the handover into the Astro
build, with the one correction §12 records.

The design questions are closed again. The next session's job is to carry this
sketch into the Astro build described in `PRODUCT.md` §Stack.


---

## 9. Decided on 2026-08-26, and built

Four questions were put to the owner and all four were answered. What follows
is what was decided and what landed, so none of it is reopened.

### 9.1 The ground - option B, paper grain

The dot matrix is deleted. One layer of fractal-noise grain at 5.5%, 128px tile,
`stitchTiles="stitch"`. The reasoning is in the `site.css` comment and is the
part worth keeping: the ground is not freedom, because freedom is what a
blank-canvas product sells and this product's claim is the opposite of coming
over here. It is the desk the app already sits on.

### 9.2 The wiring diagram - the `.turn` band was replaced

This is the session's largest change and the one borrowed most directly from
the reference read in §10.

The `.turn` section stated ADR 0046 as a sentence and showed nothing, which made
it the page's largest claim and its weakest surface. It is now a two-state SVG
with a switch. Both states differ in exactly one quantity, and that quantity is
printed under the drawing so nobody has to count wires:

- **A connector layer** - five amber wires from a hub to five destinations,
  travelling dots on all five. *Connections the product has to build and keep
  working: 5.*
- **No connector layer** - one amber wire from WordScript down into a directory,
  one dot on it, and five thin dashed grey wires from that directory up to the
  destinations. Those five are drawn as not-ours on purpose. *Connections
  WordScript has to build and keep working: 1.*

Three decisions inside it that are load-bearing:

- **The hub is relabelled per state.** In the connector state it reads *a
  dictation app*, not *WordScript*. Labelling our own product with five
  connectors is a false statement about our own product, and the count line
  under it changes subject to match.
- **The destinations are generic** - *your editor*, *your notes*, *your chat*,
  *your agent*, *your grep*. This is a comparative diagram, and naming real
  third parties inside one asserts things about their integrations that we have
  not verified.
- **It demonstrates itself once.** In normal motion it opens on the connector
  state and moves to WordScript's after 1.4s on first scroll into view, then
  stays wherever the reader puts it (`data-touched`). Under reduced motion it
  opens on WordScript's state and never moves. A passive reader never leaves
  with the wrong picture on screen.

Technique, worth knowing: the travelling dots ride an unpainted full-length path
(`#w-r*`) via `animateMotion` + `mpath`, while the *visible* wire is drawn short
of both ends. That is what makes a dot enter and leave a node cleanly instead of
stopping dead on its edge. No JS, no rAF.

### 9.3 The focus band - real logos, coloured, under the hero

The hero claims the text lands in whatever window has focus, and the page never
showed it, while 250px of nothing sat directly underneath. Now a marquee of 15
application marks at their official brand hex.

- **Source is Simple Icons, CC0-1.0**, not Lobe Icons. Lobe Icons was the
  owner's suggestion and was checked first: it is a 903-icon AI/LLM brand set,
  and of the everyday applications this band needs it carries only Notion and
  GitHub (both monochrome), Obsidian and Figma. It cannot carry this row. It
  *is* the right source if a provider row is ever wanted, since the catalogue's
  providers are Groq, OpenAI, Anthropic, OpenRouter, Bedrock and a local
  runtime - but most of those are mono there too, so that row would be quiet,
  not colourful.
- **Slack and Visual Studio Code are not available anywhere.** Both have been
  removed from Simple Icons on brand request and neither is in Lobe Icons. For a
  developer-tool audience their absence from this row is conspicuous. Flagged,
  not solved; do not hand-draw them.
- **The marks are not unified to one colour**, on the owner's explicit
  instruction. The small burst of colour is wanted. The three whose own brand
  colour is black (Notion, GitHub, IntelliJ IDEA) are lifted to the page's
  foreground, because black is not a colour on this ground.
- **The note under it does real work.** A logo row reads as an integration list
  by default, which is the exact claim the diagram two sections later disproves.
  The note says there is no plugin, no extension and no account to connect. The
  row then reinforces the diagram instead of contradicting it. Keep that note
  attached to that row.

### 9.4 The numbers section - cited measurements above the constructed ones

**Superseded by 12.1.** Ruan is still on the page but no longer as a bare
comparison, and there are three measurements rather than two. What follows is
why the caveat existed; 12.1 is what was done about it.

The owner's note was that speaking really is faster than typing and the page
never says so. Two measurements now open the section, and neither is ours:

- **51.56 wpm**, mean typing speed on a physical keyboard, SD 20.2, across
  168,000 participants. Dhakal, Feit, Kristensson and Oulasvirta, *Observations
  on Typing from 136 Million Keystrokes*, CHI 2018.
- **153 wpm**, English dictated text entry, against 52 wpm by keyboard on the
  same task. Ruan, Wobbrock, Liou, Ng and Landay, 2016.

**Both were verified against primary sources, and the second one has a caveat
that had to go on the page.** Ruan et al. measured a *touchscreen* keyboard, so
citing it as "3x faster than typing" to an audience of desk typists would be the
kind of claim `PRODUCT.md` rules out. The page states the caveat and keeps only
the half that survives it: a mouth runs at about the same speed everywhere and a
keyboard does not. The 51.56 figure is not in that paper's abstract - it is in
the body, and it was read out of the PDF rather than taken from the many sites
that quote it.

The four constructed counters stay, below a line saying they are yours, and
their feet were rewritten to describe *what is measured* rather than to assert
*how many samples were measured*. The old foot "median of 412 timed dictations"
read as a specific measured sample and travelled that way in a screenshot, away
from its disclaimer. Every sentence on a tile is now true on its own.

### 9.5 The commit field

**Superseded by 12.2. The commit field is gone from the page.** Keep reading it
only for the two techniques at the end, which the usage field inherited.

Moved out of the numbers section, into the close. Fed real data: **449 commits
across 65 active days, 2026-02-16 to 2026-08-30 by whole weeks, 28 columns,
busiest day 37.** The shape is legible - thin and irregular through spring, one
dense continuous block over the last five weeks - which is exactly what a noise
field could not do.

Two things to carry:

- **Levels are cut over active days only**, so level 1 means work happened
  rather than "slightly below average". A zero day has to read as empty or the
  field claims a rhythm the repository did not have.
- **The tracking is derived, not fixed.** The old 11px letter-spacing assumed 53
  columns. The field now measures its glyph advance and computes tracking from
  the column count so it spans its block whatever the history's length. That
  matters because the number of weeks grows with every build.

### 9.6 Also fixed, and worth knowing about

**Two section-level `p` rules were silently overriding component type.**
`.turn p` set 27px on the diagram's caption, and `.close p` set 16px on the
commit field's source line; both beat a single-class component rule on
specificity. `.turn p` is now `.turn__lead`. If you add a `<p>` inside a section
that styles its paragraphs, check the computed size before assuming your rule
won.

## 10. The reference read: voicely.de/en, 2026-08-26

Browsed live with Playwright at 1440x900. 12,014px over nine sections against
our 3,974px over eight at the time. Recorded so it is not re-read.

**What was borrowed, and it is one idea above all others.** Their privacy
section is a single inline SVG - three peripheral nodes around a hub, wires with
travelling dots, and a switch that severs them: wires go dashed and faint, nodes
dim, the hub takes a ring. One picture, one systems claim, one click that proves
it. That is the strongest thing on their page and it is now §9.2 here.

**The theme did not transfer, only the technique.** Their subject is privacy,
which §2 rules out as a position for us because it is a tie against openwhispr.
Ours is ADR 0046, which is the claim the page is actually built on.

Also taken: the fact strip closing the hero visual (theirs is stats, ours is
three things that are true today), the band directly under the hero, and the
pattern of citing third-party research with a named source instead of inventing
product numbers.

**Rejected, deliberately, and do not bring these back:**

- Green-on-black with glow on everything. That is the category's palette and
  theirs. Ours is warm amber on near-black.
- *Write 5x faster*, *Save 20+ hours*, the pricing block. Unprovable speed
  claims are the exact positioning §2 rejects and `PRODUCT.md` forbids.
- A small-caps coloured eyebrow label above every single section. All five of
  ours were removed as an AI tell; Voicely has one on every section. Do not
  reintroduce them because a reference has them.
- An icon in a rounded square on every card.
- Length as a goal. Their 12,000px is not a target.

**What we have that they do not.** Their demo is a mock email window with a
fake paste. Ours drives the shipped overlay geometry through the runtime's own
`levelToBars` curve. That asset is the page's real advantage and it is currently
the quietest thing on it.

## 11. Handover: what the next session does

**Adopt this sketch and implement it. Do not redesign it.** The design questions
are closed, the owner answered the four that were open, and the sketch is the
design contract until he says otherwise. `web/` as it stands is what gets built.

In order:

1. **Scaffold Astro** per `PRODUCT.md` §Stack - Astro with React islands, static
   output, Cloudflare Workers static assets, Tailwind v4, its own
   `package.json` and lockfile in `web/`, deliberately not in a root workspace.
   Port the sketch's HTML, CSS and JS as-is; the animated surfaces become the
   islands, everything else ships as zero-JS.
2. **Move the one generated data set to build time.** The 15 Simple Icons paths
   (`FOCUS_APPS`) should be read from the `simple-icons` package rather than
   pasted, so a brand refresh is an `npm update`. That is 9.3 KB of the JS
   bundle. The commit array this item used to name is gone (12.2); `HEAT_DAYS`
   replaced it and must **not** be generated, because it is a constructed
   example and a field that reshuffles per build is decoration.
3. **Rewrite `web/PRODUCT.md` and `web/REFERENCES.md`.** Both still argue the
   transparency-first positioning that was rejected, and `REFERENCES.md` in
   particular states the differentiator as "it shows you what it did", which §2
   replaced with the Cursor/Context/Agent triangle. They are actively
   misleading to anyone who reads them cold. `REFERENCES.md` should absorb §10.
4. **The launch gate.** `web-launch-gate` is not optional: consent under TDDDG,
   imprint under DDG §5, BFSG/WCAG 2.1 AA, and the placeholder sweep. Imprint
   and privacy details are still listed as open facts in `PRODUCT.md` and only
   the owner can supply them.
5. **`origin-exposure-gate`** before anything is publicly reachable.

**Still blocked on the owner, and it is the same request as §5.5.** The page is
entirely self-drawn; nothing on it is a photograph or a recording of the real
thing. In descending order of value: the app running over a real application
with the capsule visible and text arriving; the actual desk, shot dark enough to
sit in the palette; the Context folder in a real file manager with real
filenames and timestamps. Do not generate any of these and do not substitute
stock. He offered to supply them.

~~**Carried forward as a candidate, not a brief.**~~ **Answered and built, see
12.2.** The app's own figures are staged now: they count up from zero when the
block is revealed, and the usage field joined them as a fifth figure in the same
frame.

**One known gap with no clean fix.** Slack and Visual Studio Code are missing
from the focus band because no permissively licensed icon set still carries
them. If that band is ever the thing a reader notices for the wrong reason, the
options are to drop to a text row or to license marks properly - not to draw
them by hand.


---

## 12. The second review, 2026-08-26, and what it changed

Six things, in the owner's order. Where this section and §9 disagree, this one
is what the page does.

### 12.1 The research is a timeline now, and Ruan carries its device

The objection was the Ruan study: it measured a *touchscreen* keyboard, and a
page arguing to desk typists that cited it as "faster than typing" was arguing
from the wrong device. §9.4 had already caught that and answered it with a
caveat under the figure. A caveat under a figure is a footnote on a claim the
reader has already taken, so this pass answered it with structure instead.

The section is three measurements read in the order they were taken, and the
order is the argument:

- **1999**, Karat, Halverson, Horn and Karat, CHI '99: **13.6 wpm** transcribed
  by voice, **7.8 wpm** composed, against **32.5 wpm** with keyboard and mouse.
  Speech lost, and the page says so. This is the only place on the page where
  our own category comes off worse, and it stays, because the row after it is
  worth nothing without it.
- **2016**, Ruan et al.: **161.20 wpm** spoken against **53.46 wpm** typed, with
  20.4 percent fewer errors. Measured on an iPhone 6 Plus, 32 participants, and
  the page prints the device in the source line rather than in a disclaimer.
- **2018**, Dhakal et al.: **51.56 wpm** on a physical keyboard across 168,000
  participants.

**The finding that made this work, and it is the reason the objection could be
answered rather than dodged.** Ruan's touchscreen keyboard came out at 53.46
wpm. Dhakal's physical keyboard, on a sample five thousand times larger, comes
out at 51.56. The typing side barely moves between the two devices. So the
touchscreen caveat costs the comparison almost nothing, and the closing line
says exactly that: what moved is the other side, and what held it back in 1999
was correction rather than speed, which is the half the modes do.

**Sourcing, because this is the part that has to hold.** Ruan was read out of
the paper itself (`hci.stanford.edu/research/speech/paper/speech_paper.pdf`,
pdftotext, results section). Karat's own PDF is behind ACM's bot wall - the
abstract is free and confirms the study design, but it carries no wpm figures.
The three figures used here are quoted in Ruan et al. as reference [10], which
is a peer-reviewed publication citing the primary, not a site quoting a site.
**If a better source for Karat turns up, check the three numbers against it.**
Every other route was a marketing page or a newsletter, and one of them was the
Nuance case study Voicely's healthcare cards are built on.

Two bars per step, one ruler for all of them (161.2 wpm), and both the bars and
the figures animate in on reveal. The counters read their delay off the
computed `transition-delay` of the bar beside them, so the stylesheet stays the
one place that decides the order.

### 12.2 The activity field counts dictations, not commits

§9.5 fed the field this repository's commit history. That was the wrong
subject: the field was always meant to be the app's own usage, drawn the way a
contribution graph draws it, and to sit *with* the four figures rather than to
close the page.

- The commit field, `CAL_DAYS`, `CAL_META` and the whole `.cal` block are gone
  from the HTML, the CSS and the JS. The close is a call to action again.
- `HEAT_DAYS` is 52 weeks of dictations per day, written out as data. It is a
  constructed example under the same disclaimer as the four figures, and it is
  **not** generated at load: a field that reshuffles on every visit is
  decoration, and this one is standing in for a reading off a file.
- The two techniques from §9.5 carried over: levels are cut over active days
  only, so level 1 means a day something happened; and a zero day reads as
  empty or the field claims a rhythm nobody had.
- The four figures count up from zero on reveal, and the five share one frame.
  The section lead and the disclaimer both say five now, not four.

### 12.3 The demo is not a box any more

Tabs, window, and slabs inside the window made three frames for one idea. Now:
the three tabs stand on the ground as separate cards, the window is the only
thing in the section with an edge, it carries a light and a window shadow, and
the replay footer moved outside it because it is a control for the demo rather
than part of the surface being demonstrated. Inside the window, any slab that
*reports* on the scene gave up its ground; only the surface being acted on
keeps a raised one. That is one plane instead of three.

### 12.4 The wiring diagram performs the claim instead of illustrating it

- **The switch was a cross-fade**, which is a slideshow: both states were always
  drawn and one was turned down. The wires draw and undraw themselves now. Every
  path carries `pathLength="1"`, which is what lets one `stroke-dashoffset` rule
  work across eleven paths of eleven different lengths. Read in the direction
  that matters: the five owned wires retract into the hub, the folder drops in
  where they met, one wire comes back up into it, and only then do the borrowed
  wires reach down. The delays are the argument, not decoration.
- **The caption was four lines and is one sentence.** Whatever the drawing says,
  the text must not say again.
- **The nodes have glyphs.** Generic ones, and deliberately: §9.2's rule holds,
  a real mark inside a comparative diagram asserts something about that vendor's
  integrations that we have not verified. The glyphs say what kind of tool
  without naming one. The hub has a microphone, which it never had.
- **Labels**, from the owner: `your agent` is **`your agent CLI`**, the folder
  reads **`a folder you named`**, and the WordScript caption is one plain file
  into a folder your agent CLI already opens. The agent CLI's glyph lights amber
  in our state, because that is the node the dictation is addressed to.

### 12.5 The ground has light and planes

The grain answers what the ground is made of. It never answered why one part of
the page is further away than another, and without that a long dark page is one
flat sheet. Two devices, both cheap:

- **`.plane`**: a section steps down the ladder to `--bg-sidebar` and back, with
  the step made by a gradient rather than a rule. `.turn` lost its two 1px
  borders to this. `#numbers` gained one.
- **`.lit`**: a warm shadow with a long blur under the diagram and under the
  five figures, plus the light the demo already had. It is drawn as the object's
  own shadow rather than as a field behind it, because both surfaces clip their
  overflow and a shadow is the one form of light that survives that. Three
  objects, not everything: a glow on everything is the category's look and says
  nothing.

### 12.6 There is an address

`forge@sw-labs.de`, in the footer and as a quiet line under the two buttons in
the close. Not a third button: the buttons are rooms you join and an address is
not a room. `.close p` is a section-level rule that beats a single-class
component rule, which is the trap §9.6 records, so the rule is `.close
.close__mail`.

### 12.7 Measured after all six

- **Overflow**: none at 360, 390, 430, 620, 768, 900, 1024, 1080, 1280, 1440,
  with `.focus__rail` and `.band` excluded as §6 requires. Zero offenders at
  every width, not a reduced count.
- **Contrast**: 45 elements checked across the new surfaces, no AA failure.
- **Reduced motion**: 23/23 reveals shown, the three timeline steps on their end
  widths, figures on their printed values, the field at full opacity, the
  diagram on `ws` with the five owned wires retracted, SMIL paused by hand.
  Three new rules had to be added to the reduced-motion block: a `.01ms`
  duration behind a `1.24s` delay is still a picture that assembles itself a
  second late.
- **Payload**: index 29.9 KB (8.0 gz), CSS 64.9 KB (16.6 gz), JS 66.5 KB
  (21.9 gz). The JS is 0.4 KB smaller than before despite gaining a counter
  engine: the commit array left and both wire captions were cut.
- **Banned punctuation**: 0 em-dashes, 0 en-dashes, 0 middle dots, 0 curly
  quotes, escaped forms included. The only non-ASCII left in the three files is
  the German in the Translate scene's fixture.

### 12.8 Still open, and unchanged

§5.5 is still the one unbuilt item and still blocked on the same assets: the app
running over a real application, the desk, the Context folder in a real file
manager. Nothing on this page is a photograph. Do not generate one.

---

## 13. The third review, 2026-08-26, and what it changed

Six findings, from a read of the built page against a running app. The
derivation is [ADR 0253](../docs/decisions/0253-the-page-performs-each-claim-once-instead-of-listing-it-and-the-hero-stops-asking-to-be-operated.md);
this section is the operational half.

They have one shape in common, which is the thing to carry forward: on every
one of them the page was **describing** a claim it could have been **making**,
and charging the reader for the description.

### 13.1 The hero plays. It does not ask. (This overturns 12 and ADR 0252.3.)

The hold-to-talk hero is gone. It is an autoplay loop over the six concrete
modes: park in `mode-picker`, record, process, deliver, grow the learned tab
where the scene has one, advance, repeat. It runs on an IntersectionObserver at
threshold 0.25 and stops off screen; under reduced motion it prints the settled
reading and never starts.

Three reasons, all structural:

- The gesture is learned **inside** the product, after onboarding has named the
  chord. A first-time reader on a marketing page has a rectangle and a capsule.
- A hold too short to capture anything is answered with the `error` state. That
  is faithful and it is the wrong first impression: somebody who has never seen
  the product working reads a failure as a broken page.
- The hero is the one surface that has to work without being worked. It is the
  only evidence the thing is real that a reader gets before deciding to care.

**What stays:** the mode chip is still a button and pressing it advances the
loop. ADR 0252's rule -- a surface that invites a press has to answer one -- is
kept; what was reversed is making the hero an instrument.

**What is given up:** reader-controlled capture length, and the `error` state,
which now has no scene anywhere on the page. Do not add one back to the hero.

### 13.2 The learned tab is the shipped learned tab

The page drew `learned backfill`, split into a muted verb and an accent word.
The app draws one accent dot beside the word alone (`word`, or `word +N` when a
dictation taught more than one) and keeps `Learned: a, b` in the `title` and
the `aria-label`. Geometry is now copied value for value from
`src/styles/overlay-pill.css`: 22 px tall, `right: calc(100% + 6px)`,
`margin-top: -11px`, inner pinned right at `max-width: 168px`, gap 5 px,
padding `0 9px`, `10.5px/500` at `letter-spacing: .01em`, dot 6 px, border
`rgba(232,145,42,.34)` which is `--ov-accent-border`. The hold is 3660 ms,
which with the shutter's two ramps is `LEARNED_NUDGE_DURATION_MS`.

**The rule, for whatever the page draws next:** the capsule is not a component
this site owns. It is the app's surface reproduced. A difference in it is
reported and fixed, never justified.

### 13.3 One mode control, and it is the app's own gesture

The seven-button mode strip is gone. The product has no such control: it
changes modes on a per-mode key, on the picker key, or by pressing the chip on
the capsule. The page was drawing a control the app does not have, beside a
capsule carrying the one it does.

The mode now changes in two places, both calling the same thing: the chip, and
one button under the window naming the current mode, its key and that it is one
of seven. The button is not redundant -- the chip is absent on `result-actions`
and under reduced motion, so without it the control is unreachable by keyboard.

Delivery stays a two-button segment: `auto_paste` and `clipboard_only` are a
choice between two named things, not a cycle, and the two endings are the
section's argument.

The section is 61 px shorter (1051 to 990 at 1440x900), the two delivery cards
are gone, and each of the three leads is one sentence.

### 13.4 The numbers block is one arithmetic

Four independent literals sat under a line claiming they came from the field
above them. Every figure is now computed in `src/lib/heat.ts` from the same
364-day array the field draws:

- the speaking rate is the divisor that turns each day's words into that day's
  seconds, so the field and the tile cannot disagree;
- `Time saved` is `ledgerTimeSaved`'s formula over `SAVED_WINDOW_DAYS`
  (4 weeks), with the baseline in the foot because ADR 0182 says the baseline
  is the reading rather than context about it;
- **`Turnaround` was 1.9 s and is 0.9 s**, which is what ADR 0247 and ADR 0248
  measured;
- `Languages` names the share and the denominator it was measured on
  (ADR 0186).

The hover carries meetings and uploads, which the product records and the page
had omitted. No Developer Mode tag, per ADR 0252 decision 1.

### 13.5 The engine grid is four cards and one profile

Eight jobs by three lanes was twenty-four mono model ids: complete, unreadable,
and with its only actionable content -- the four cells reading `none` -- as its
quietest text. And it drew three lanes where the product has four, because it
was generated from the catalogue's `lanes` block and the fourth lane has no
catalogue rows by construction.

What replaced it:

- one line naming the eight jobs, which is the grid's row headers at a
  fraction of the height;
- four cards, one per lane, each answering what the lane is, how many of the
  eight it serves, who runs on it, and **what it costs you to operate** -- the
  credential shape, which is the fact that actually decides which lane somebody
  picks. `Your server` draws the two fields it takes instead of a vendor row,
  because a row of logos there would assert a compatibility matrix nobody has
  measured;
- one profile: four jobs, three lanes, every model read from the catalogue's
  own default for that pair.

Marks come from `@lobehub/icons-static-svg` (MIT), the same package and version
`src/components/shell/brandSymbols.ts` uses, read at build time by
`src/lib/marks.ts`. **Mono variants, and the loader enforces it**: the colour
files carry gradients with internal `id`s and the same mark repeats on this page
(OpenAI on Cloud and Local, Anthropic on Cloud and in the profile), which inline
is duplicate ids in one document. `body()` throws on an `id=` or a hard-coded
`fill="#`.

A vendor the set does not carry rides as its name beside a dim dot. Dropping
the glyph is a rendering decision; dropping the vendor would be a claim about
the product. Do not turn that dot back into an outlined square: at 13 px in a
row of logos it reads as a broken image.

### 13.6 Two hydration warnings, fixed

Both islands root on a `.rise` element whose `is-in` is added imperatively by
the reveal observer in `Base.astro`, and both are `client:visible`, so the
served DOM carries a class that is not in the JSX by the time React hydrates.
React reports it and then leaves the server's value alone. The className is a
literal that never re-renders, so `suppressHydrationWarning` says the
difference is intended; moving the reveal into React would leave two mechanisms
deciding one class. **The built page now reports zero console errors.**

### 13.7 Measured after all six

- **Overflow**: none at 360, 390, 430, 620, 768, 900, 1024, 1080, 1280, 1440,
  with `.focus__rail`, `.band` and now `.own__tip` excluded as §6 requires.
  `documentElement.scrollWidth` is the viewport less the scrollbar at every one.
- **Contrast**: 283 elements checked in the settled state, 0 AA failures.
- **Reduced motion**: 28/28 reveals shown, SMIL paused by hand (25 animations,
  `animationsPaused()` true), the hero capsule settled on `result-actions`, all
  seven modes settled (six Delivered, Auto Routed), all three intakes settled
  (Delivered, Written, Answered), the diagram on `ws`.
- **Console**: 0 errors on the built page.
- **Banned punctuation**: 0 em-dashes, 0 en-dashes, 0 middle dots, 0 curly
  quotes, in the sources and in the built HTML, CSS and JS. The only non-ASCII
  in the build is the German in the Translate scene's fixture.
- **Payload**: HTML 126.4 KB (27.9 gz), CSS 65.4 KB (13.4 gz), JS 233.8 KB
  (76.4 gz) across ten chunks, of which React is 179.7 KB (55.7 gz).

### 13.8 Still open, and unchanged

§5.5 is still the one unbuilt item and still blocked on the same assets. And
the engine section has one place it can go stale silently: a **provider** added
to `shared/model_catalogue.json` appears on a card with no edit here, but a
**lane** added to the product does not, because the four lanes are the one
hand-written list in `src/lib/catalogue.ts`.
