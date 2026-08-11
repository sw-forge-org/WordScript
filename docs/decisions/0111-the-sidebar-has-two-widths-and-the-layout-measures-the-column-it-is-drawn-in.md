# 0111: The sidebar has two widths, and every layout measures the column it is drawn in

Date: 2026-08-11
Status: Accepted

## Context

ADR 0104 measured the shipped window and closed with a finding it did not act
on:

> **The workspace has no width breakpoint at all.** `shell.css` carries two
> `@media (max-width: …)` rules and neither is the workspace's; the four
> `@container` rules are at 560 and 640 px, inside components. Below the width
> the design assumes, the layout does not rearrange — it compresses, and the
> text column is what pays, because it is the only flexible thing in the row.

It also supplied the arithmetic. `tauri.conf.json` declares the settings window
at 1000 × 760 and `minWidth: 880`; on the owner's display at `Xft.dpi: 120` the
scale is 1.25, so **the layout gets 800 CSS px by default and 704 at the
declared minimum**. The workspace's real range is therefore 704 px upward, and
232 of those px are a sidebar.

The owner reported the consequences on 2026-08-11, from the running host, at
roughly 700 CSS px:

- **Home** — the `Change in profile` button hung 5 px past the content column.
- **Profiles** — the pane's list column is a flat 236 px, so the detail beside
  it had **227 px**: a profile's whole settings surface drawing three words to a
  line, with its sub-tab row wrapped into three rows.
- **AI Models** — every control in an open job's well sat hard against the
  well's right edge while its label sat 25 px in from the left one.
- Later in the same session, at a narrower width still, a **legend row drawing
  `sets / how / a / sentence / is / built` one word to a line, with the badge
  column drawn over the top of it.**

The first and third are bugs at any width. The second and fourth are ADR 0104's
finding arriving.

## Decision

### 1. The sidebar has two widths, and the window may choose one of them

`--nav-w-rail: 56px` stands beside `--nav-w: 232px`. In the rail the sidebar
draws icons only: the app icon in place of the wordmark, the search field as the
icon it already carries, every navigation row as its own tile, and the active
profile as its avatar. **It is the same sidebar with its labels withheld** —
every rule about a row's tile, its active ground, its accent and its hover is
untouched, which is the test that this is one component in two states.

**Who decides is two different things and they are stored differently.**

| | Where it lives | Why |
| --- | --- | --- |
| The user pressed the toggle | `AppConfig.workspace_nav_rail` | a preference, and it survives a restart, exactly as `color_scheme` does |
| The window is too narrow to afford 232 px | React state only | *state*, not preference — dragging a window narrow and wide again expresses nothing |

The breakpoint fires on a **crossing**, not on every width: `matchMedia` emits
one event per crossing, so shrinking past the floor rails the sidebar and
growing back past it restores what the user chose. Between crossings the toggle
is the authority and nothing overrules it.

**The floor is 760 CSS px**, which is the one number that leaves ADR 0104's
default 800 px window expanded while railing the 704 px minimum.

### 2. A layout measures the column it is drawn in, never the window

`.ws-content`, the settings sheet's scroller and **a pane's detail column** all
declare `container: ws-column / inline-size`. Every responsive rule in the shell
is an `@container ws-column` query.

**The rail is what makes this the only correct choice.** The content column is
the window minus a sidebar that is now 232 px *or* 56 px, so two windows of the
same width can hand their content a column 176 px apart. A viewport media query
would be measuring the one quantity that stopped predicting the layout.

The name matters because **the nearest one wins**: a rule inside a pane
therefore measures the detail column it is actually drawn in. That is what the
four `@container` rules already in the file were reaching for and could not
have — they resolved against `.ws-content-inner`, which in a pane is the full
column and not the half the row sits in.

### 3. Three tiers, and each gives up the cheapest thing left

| Column width | What changes |
| --- | --- |
| ≤ 620 px | `--content-pad` falls from 32 to 24 |
| ≤ 460 px | `--content-pad` falls to 16; **`.ws-row` becomes a stack** — the control takes its own line and the text column takes the whole row; **fixed-track grids collapse to one column** |
| — | below that nothing further is given up: the card must still read as a card on a ground |

The inset goes first because it is the only thing on the screen that is pure
margin. The row is next because `.ws-row-ctl` is `flex: none` and every pixel it
takes comes off the text column (ADR 0092) — the stack is the arrangement
`.ws-row[data-layout="stack"]` already draws by hand for the rows that always
need it, so nothing is invented and nothing is hidden.

**A fixed grid track does not degrade, it collides**, which is why the grids are
a separate rule rather than left to compress: an `auto` track will not shrink
below its content, every pixel it is short comes out of the flexible track
beside it, and past a point that track is narrower than one word. The grids are
named rather than swept, because a blanket rule would also flatten the grids
that are a *shape* rather than a layout — the job summary's chevron/text/badge,
and the pane itself.

### 4. The pane's list column is a range

`--pane-list-w: clamp(176px, 32cqi, 236px)`. 236 is the drawing's width and it
gets it whenever the column can afford it; 176 is where a row's two lines — a
name and `Auto · Clipboard only` under it — both still read.

**The rail and this clamp answer together.** Because the sidebar rails below
760 CSS px, the content column never falls below roughly 648 px, so the pane's
detail column never falls below roughly 440 — which is why there is no
one-column pane mode and no need for one.

## Consequences

- **The icon set gains its 79th glyph, and it is the first that is not the
  prototype's.** `demo.js`'s `ICONS` and `iconPaths.ts` were name-for-name
  identical. The prototype's sidebar has one width and therefore no control to
  change it, so there is nothing to port; `sidebar` is drawn at this set's radii
  and stroke rather than borrowed from lucide.
- **Two things found on the way out are fixed here and are not width bugs.**
  The open job's well paid its inset on the left and nothing on the right; and
  `.ws-menu` carried no `z-index`, so the Help panel — an opaque
  `--bg-surface` — was painted over by every positioned box in the content
  column, which reads exactly like transparency and was reported as such.
- **The settings sheet's profile control was a link wearing a popup button's
  chevron.** `ProfileSwitcher`'s own note has claimed since Leg 3 that it is
  "the same control in the workspace sidebar and in the settings sheet's
  header"; it was a `SheetProfile` that navigated to Profiles and closed the
  sheet. It is the same component now, in a `sheet` variant. `SheetProfile` is
  deleted rather than aliased (ADR 0054). The door to Profiles is not lost with
  it — every scoped row on those screens carries its own.
- **A refused profile switch is now visible.** `.catch(() => {})` swallowed the
  runtime's refusal, so the `<select>` sprang back to where it started with
  nothing said, which is the whole of the "sometimes it just does not switch"
  in the same report. The sidebar prints the sentence; the sheet's header
  strip, which has no line for one, draws the refusal on the row and carries
  the sentence in its tooltip.
- **The declared `minWidth` is still in physical pixels and is still not the
  layout's floor** (ADR 0104). Nothing here changes `tauri.conf.json`. What
  changes is that the layout no longer needs it to: it rearranges rather than
  compressing, at whatever CSS width it is handed.
- **The native host is the only instrument for the rail.** The measurements
  behind this record were taken in headless Chromium against a stubbed IPC,
  which is enough to find geometry and not enough to judge WebKitGTK — the
  engine where a `backdrop-filter` is inert and four consecutive legs have found
  a defect no browser preview showed.
