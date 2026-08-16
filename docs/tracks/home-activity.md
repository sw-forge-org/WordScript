# The home activity track

Opened 2026-08-16. **Stage A steps A1 and A2 are landed; A3, A4 and A5 are
open.** Both the orientation page and the sequence — start a session here.

Owns **ADR 0171–0180**.
[ADR 0171](../decisions/0171-an-instruction-is-read-once-so-home-has-two-lives-and-a-counter-with-no-reading-is-dark-rather-than-zero.md)
is written and covers what A1 and A2 built. The remaining decisions on this page
are recorded here rather than as records, because an ADR is append-only and
nothing has been built against them yet; the session that lands them writes the
next one. Grep the tree before claiming a number — six tracks share `main` and a
number gets cited in source before its file lands.

## Why this track exists

**Home opens on a drawing of a keyboard.** `HeroInvoke` puts two 42 px 3D
keycaps and one sentence — *Press in any app to dictate* — in the most
prominent position the product has. `HomeHero.tsx` argues for it explicitly:

> WHAT IS NOT IN IT. No metric, no count, no ring, no "3 dictations today". The
> product does not have a number worth that position — the thing worth that
> position is the shortcut.

That argument was right when it was written and it has one flaw the owner named
on 2026-08-16: **an instruction is read exactly once.** After the first day the
most valuable surface in the product is spent on a sentence nobody reads again,
and the reader has no idea what the tool has actually done for them.

The claim in that comment — *the product does not have a number worth that
position* — is also no longer true. `TranscriptionHistoryEntry` carries words,
`capture_integrity.recorded_seconds`, insert outcomes and timestamps. There are
numbers. Nothing reads them.

## What this track does not own

| Not this | Whose |
|---|---|
| Carrying a drawn screen into the product 1:1, the gallery, `port:diff` | [`gui-port-relay.md`](gui-port-relay.md) |
| Provider lanes, credentials, model catalogue, recognized language | [`speech-track-plan.md`](speech-track-plan.md) |
| What a recorded object is, and its five origins — meetings and uploads | [`context-objects.md`](context-objects.md) |
| Session commit, insert reliability, the park | [`runtime-ownership.md`](runtime-ownership.md) |
| Fluent-and-wrong output on the cleanup lane | [`core-hardening.md`](core-hardening.md) |

**The seam with the GUI port is the sharp one and is the reason this is its own
track.** That relay's acceptance surface is `port:diff` measuring the product
against `demo.js`. The prototype has no activity calendar and no counter tiles;
this work therefore cannot be scored by exactness against a drawing, and filing
it as a leg would either corrupt that measure or hide behind it. Leg 13b's own
finding says the same thing from the other side: *the cost is that the grown
state is unmeasured by the port*. This track's surfaces are held by tests and by
the gallery, not by the differ.

## The decisions

Made with the owner on 2026-08-16. **Do not re-open them; build them.**

### 1. Two views, not one, and they answer different questions

Home's opening block carries **either** an activity calendar **or** four counter
tiles. The reader chooses; the choice persists.

They are alternatives rather than companions because they answer two different
questions:

- **The calendar is your rhythm** — what you did, day by day.
- **The tiles are your character** — who you are, averaged.

Because the calendar carries all the movement, the tiles are allowed to be
slow-moving. That was their problem when they had to do both jobs.

### 2. The calendar is a matrix

A GitHub contribution graph and the dot-matrix readout already in the tree
(`src/components/ui/matrix.tsx`, ElevenLabs UI, MIT) are the same visual object:
a grid of discrete lit points on an on/off ramp.

So the calendar renders **circles, not squares**, on the matrix palette —
`--fg-muted` unlit through four steps to `--accent`. The two views then stop
being two widgets and become two states of one display, which is what makes it a
recognizable mark for the product rather than a borrowed GitHub graphic. It is
intended to travel to the website.

### 3. The tooltip carries the day, and it is where the detail metrics live

GitHub says *5 contributions on March 3*. That is poor. A day here reads:

> **Tuesday, 12 August** · 14 dictations · 2 meetings · 1 upload · 3,200 words · 148 wpm

This is what dissolves the "which four metrics" problem: **everything
day-scoped moves into the hover.** Sessions today, longest dictation, words —
none of them needs a tile, because each is a property of a day. A tooltip may be
rich, because only a reader who went looking sees it.

### 4. The four tiles

**Words per minute** (average) · **Time saved** (rolling 7 days) ·
**Apps** (total) · **Languages** (total).

Read left to right they make a sentence: *this is how fast you speak, this is
what it gives you back, everywhere, in these languages.*

### 5. Digits, and how they are allowed to grow

Numbers render as `digits` from the matrix — ten 7×5 frames, 0–9. There is no
alphabet, so **labels stay ordinary text**; only the number is matrix.

A multi-digit number needs a composite frame: N digit frames merged with one
blank column between them. It does not exist yet.

**Each tile reserves four digit positions and sets the number right-aligned
inside them.** The number grows leftwards into space already held, so the grid
does not jump when 99 becomes 100.

### 6. Every number is bounded, by construction

Three to four digits is not a layout preference, it is the selection rule.
Cumulative totals — words spoken, minutes recorded — run away and end up
abbreviated, at which point a counter stops being a counter. Only four shapes
are admitted:

| Shape | Example | Why it stays small |
|---|---|---|
| Rates | words per minute | settles and stays |
| Ratios | percent landed | 0–100 by construction |
| Small sets | apps, languages | naturally few |
| Windows | last 7 days, this month | resets |

**Seconds until the text is ready** was considered and cut from the tile set.
The owner's objection was correct as first defined: *time until the text is with
you* ends at the reader, and with clipboard delivery nobody knows when that was.
It is measurable if defined as **release until the text exists**, which is
inside the runtime and shared by both delivery paths — but it is the weakest of
the candidates emotionally, so it belongs in the tooltip, not in a tile.

**Streak as consecutive days was rejected.** It punishes a holiday and turns a
tool into an attendance sheet. Its replacement, *active days this month* (0–31),
is a property of the calendar and needs no tile at all.

### 7. No tile and no calendar may sit at zero for long

A zero in a counter does not read as *nothing yet*, it reads as *broken*. Two
consequences:

- **The instruction is the state before the first dictation; the display is the
  state after.** The same surface, two lives. The keycaps' job is done the
  moment they have been read once, which is exactly when they disappear.
- **The calendar grows with the installation.** It shows as many weeks as the
  install has existed, filling rightwards until it is full. A fresh install
  showing 365 grey cells reads as a defect, not as a beginning.

### 8. Width, and how much time is shown

Home has **696 px** of usable width (`--content-max: 760px` less
`--content-pad` both sides). A full GitHub year is 53 weeks at ~13 px = 689 px —
it fits, on the edge, with tiny cells.

**Take 26 weeks at roughly double the cell size (~470 px).** WordScript is not
an annual-review product; for a tool used daily, *how was my half-year* is the
honest question, and larger points read as a matrix rather than as a
spreadsheet.

### 9. The switch is on the thing, not in settings

Clicking the block toggles it, with a small two-dot carousel indicator for
discoverability. The choice persists in config. No settings row is added for it.

## What can be wired today, and what cannot

**This is the table the preview banner is written from.** Every row that moves
to *yes* shortens the banner.

| Reading | Today | What it needs |
|---|---|---|
| **Words per minute** | **yes** | words from `transformed_transcript ?? raw_transcript`, seconds from `capture_integrity.recorded_seconds`. That field is `null` on retries and on entries older than the measurement, so the average is over what was measured and says so |
| **Time saved** | **yes** | the same two, against a typing baseline. The baseline is an assumption, not a measurement — it is rendered with `≈` |
| **Longest dictation** | **yes** | max `recorded_seconds` |
| **Dictations per day** | **yes** | `created_at_ms` |
| **Apps** | **no** | `core::workspace_context` already resolves `app_name`, `bundle_id` and `category` for the transform context, but **no history field stores it**. Needs a field, and a privacy decision — recording which applications a person dictates into is a new collection, and the retention rule has to name it (ADR 0138's shape) |
| **Languages** | **no** | `entry.language` is `optional_non_empty(&app_config.language)` — the **setting**, not what was recognized. The provider does return `response.language` (`core/history.rs`), but it is passed to recognizer repair and never written to the record. A tile counting it today would count how often the setting was changed. Tied to the core-hardening record where a German dictation returns in English |
| **Meetings, uploads in the calendar** | **no** | origins that do not exist. [`context-objects.md`](context-objects.md) owns them; the calendar reserves the tooltip lines and shows them only once an origin can produce one |
| **Anything lifetime-scoped** | **no** | `history_limit: 200` and `history_retention_days: 90`, pruned on **every** read. A total built from history grows, sticks at 200, then runs backwards. Either every figure is labelled with its window, or the runtime keeps counters that survive pruning. **Stage A takes the window labels; Stage B decides on counters** |

## How the unbuilt half declares itself

Per the owner, and per ADR 0161 — which already holds that a per-screen banner
is the wrong size for a half-wired screen while a per-row tag is the right one:

- **A tile whose reading is drawn carries `PreviewTag` beside its label**, with
  the tooltip saying what it waits on.
- **The screen keeps its `PreviewBanner`**, and the banner names precisely what
  is not read yet rather than repeating a generic sentence. Draft for the close
  of Stage A:

  > Wired in part — words per minute and time saved are measured; apps and
  > languages are drawn; the calendar counts dictations only, because meetings
  > and uploads have no origin yet.

- **Home's banner currently reads "Preview" over a screen that is wired**, which
  is the defect that opened this conversation. `PreviewBanner` takes a `lead`
  prop; the banner's chip becomes **Wired in part**. `registry.test.tsx` reads
  banner *presence*, not its wording, so the gallery entry is unaffected.

## The component to build on

Researched 2026-08-16 rather than written from memory.

**Take [`@uiw/react-heat-map`](https://github.com/uiwjs/react-heat-map)** — MIT,
SVG, no heavy dependencies. The decisive prop is `rectRender`, which replaces the
emitted `<rect>` wholesale, so decision 2's circles are a render override and not
a fork. `panelColors` carries the accent ramp; `legendRender` the legend.

**Vendor it rather than depend on it**, with the provenance header the repo
already uses for ElevenLabs UI (`src/components/ui/matrix.tsx`): source URL,
commit, fetch date, local changes marked. We modify it enough that upstream
updates would only fight us.

Considered and not taken:

- [`react-activity-calendar`](https://github.com/grubersjoe/react-activity-calendar)
  — MIT, most popular, good a11y, more opinionated about theming.
- [`shadcn.io` activity streak block](https://www.shadcn.io/blocks/stats-activity-streak)
  — copy-paste and brings streak counters, but pulls NumberFlow and motion/react
  and renders divs rather than SVG. Good reference, wrong base.
- [`gurbaaz27/shadcn-calendar-heatmap`](https://github.com/gurbaaz27/shadcn-calendar-heatmap)
  — sits on react-day-picker. A datepicker engine is too much machine for a
  heatmap.

## The record — A1 and A2, 2026-08-16

Session one. Unit was Stage A steps A1 and A2, both complete; the calendar was
not touched. The decisions on this page were built, not re-opened. Everything
below is in
[ADR 0171](../decisions/0171-an-instruction-is-read-once-so-home-has-two-lives-and-a-counter-with-no-reading-is-dark-rather-than-zero.md)
in its durable form; what is here is what the next session needs and what the
step cost.

**What landed.** `DigitCounter` (`components/shell/DigitCounter.tsx`) with
`counterFrame` and `counterDigits`, and its gallery entry as a third section on
the Design System's Motion page — three cells, `7`, `1,240` and no reading, so
the equal box width is judged by looking as well as by measuring. The four tiles
and the empty state on Home, with the readings derived in `lib/activity.ts`
(`wordsPerMinute`, `timeSavedMinutes`, `timedRuns`, `wordsIn`) rather than in the
screen. The 42 px caps are gone entirely and the shortcut is in the fact line as
`Keycaps`. Home's banner chip reads **Wired in part**.

**Suite: 667 → 697 over 46 → 48 files.** Thirty cases added, none deleted: 10 for
the counter, 11 for the derivations, 9 for the display. Three existing cases were
rewritten in place — the two the Traps section predicted, plus one it did not,
below. `npm run build` clean. No `cargo` command; nothing under `src-tauri/` was
touched. A dev host was running for the whole session and was left running.
Runtime log 5899 → 6201 lines, which is that host's own output; no capture
measurement was in flight.

**The four Traps all applied and all held.** `Home.test.tsx`'s keycap case moved
to the fact line rather than being deleted; `port:diff home` is recorded below
as intended divergence — **Home is no longer a ported screen**; nothing under
`src-tauri/` was written while the host was up; and `capture_integrity`'s nulls
are the reason both measured tiles print `N of M runs measured` on themselves.

**Two more traps came out of building rather than reading**, and both are now in
the Traps section: a test pinned to the word `Preview` that no step could have
graded a banner without hitting, and an SVG presentation attribute that beats
every rule in `shell.css`. **A3 will meet the second one** — it draws a much
bigger SVG in the same wrapper.

**One number the next session inherits.** The counter's 2 x 2 tier is derived
from the counter's own width: four tracks of 136 px plus three 16 px gaps need
592 px of content and the column spends 64 px on inset, so the tier sits at a
656 px column. **A 470 px calendar has its own arithmetic** and does not inherit
this one.

**One observation, not a change.** The empty state is lighter than what it
replaced: the first-run instruction is a 16 px lead line with the caps below it
in the fact row, where it used to be two 42 px objects. That is what A2 asked
for and it was built as asked. It is worth a look with the owner before A5,
because A5 is the step that could give the reader a way back to it.

## The sequence

**Stage A — the surface, on what already reads.** Nothing here is blocked.

| Step | What | Done means |
|---|---|---|
| **A1 · done** | The digit counter component: composite frame from `digits`, four reserved positions, right-aligned. Gallery entry. | It renders 7 and 1,240 without the box changing width |
| **A2 · done** | The four tiles on Home, **and the empty state in the same step**. Keycaps out — `KeyCap`, `keyCaps()` and the cap style block are Home-only and went entirely. The shortcut moved into the hero's fact line as the small `Keycaps` (the one `Context.tsx` uses). | Words per minute and time saved read from history; apps and languages carry `PreviewTag`; **a profile with no dictations sees the instruction, not four zeroes** |
| **A3** | The calendar, vendored and converted to circles on the matrix palette, 26 weeks, growing with the install. | A day's colour steps with that day's dictation count |
| **A4** | The day tooltip. Dictations real; meetings and uploads present as preview lines. | Hovering a day names its composition |
| **A5** | The switch, its indicator, and persistence. **Touches Rust** — the preference is a field on `AppConfig`, on the shape `useNavRail` already uses. | The choice survives a restart |

**A2 carries the empty state and A5 does not.** The first draft of this sequence
put it in A5, which would have left every build between A2 and A5 showing a
fresh profile four zeroes and no instruction — the exact state decision 7
forbids. **A step that removes the only copy of something restores it in the
same step.**

**Stage B — what other tracks owe.** Each step belongs here only for the surface;
the data half is the named track's.

| Step | What | Waits on |
|---|---|---|
| **B1** | Recognized language on the record — pass `response.language` through, config as fallback | speech / core-hardening |
| **B2** | Target application on the record, plus the retention rule that names the new collection | privacy decision, runtime ownership |
| **B3** | Lifetime counters that survive pruning, or a final decision that every figure stays window-labelled | this track |
| **B4** | Meetings and uploads as calendar origins | [`context-objects.md`](context-objects.md) |

## Traps

The first four were found by reading the tree on 2026-08-16, before any session
opened; the last two by building A1 and A2 the same day. Each one is cheap to
walk into and expensive to notice later.

**A TEST CAN BE PINNED TO A WORD RATHER THAN TO A FACT, and `ia.test.tsx:64` was.**
It rendered every screen carrying a banner and asserted `/Preview/i` appeared —
which is the same thing as *a banner rendered* only for as long as every chip
says `Preview`. A2 graded Home's chip **Wired in part** and the case went red for
saying something honest. It now reads the `.ws-banner` element and asserts its
chip is non-empty. **Any step that grades another screen's banner would have hit
the same wall**, and the general form is worth carrying: a case that stands in
for a structural fact must assert the structure, or the first honest change is
the failing one.

**AN SVG PRESENTATION ATTRIBUTE BEATS EVERY RULE IN `shell.css`, AND THE UNIT
SUITE CANNOT SEE IT.** `DigitCounter` is capped at its natural width so a narrow
column can shrink it, and `.ws-counter svg { width: 100% }` — the obvious
spelling — changed nothing at all. An SVG `width`/`height` attribute is a
*presentational hint*, which is unlayered, and **unlayered author styles beat
layered ones regardless of specificity**; every rule in `shell.css` lives inside
`@layer components`. The result was a 118 px tile holding a 136 px display
hanging out of its card. `max-width` is a property the attribute does not set, so
that is what the rule uses. jsdom applies no stylesheet, so this was found by
rendering the workspace in a browser with a `__TAURI_INTERNALS__` stub and
measuring `getBoundingClientRect()` against the box. **A3 draws a far bigger SVG
in the same wrapper**: measure it, do not read the CSS and believe it.

**`Home.test.tsx:150` asserted the keycaps by name — SPENT, A2.** It read
`.ws-keycap` and expected `["Ctrl", "Super"]`; A2 deleted that class and the case
went red, which is exactly where an agent under pressure deletes a case instead
of rewriting it. It moved to the fact line, where the shortcut still is, and
gained a second assertion that no element with `keycap` in its class remains
anywhere. **`screens.test.tsx`'s Home case had the same shape** and moved the
same way. Left here because the shape recurs: if the suite loses a case at the
end of a step, the step is wrong.

**`port:diff` takes screen names as arguments and will one day be pointed at
`home` — LIVE, and now expected.** It is not in CI and nothing forces it, but a
later session running `npm run port:diff home` will get a large diff against
`demo.js` and has no way to know it is intended. That is not a regression: **the
prototype has no activity display, and Home stopped being a ported screen at
A2.** This paragraph and ADR 0171 are the record that says so. (Note also that
`port:diff` with no screen names walks nothing and reports a free ALL EXACT — a
green run proves nothing unless it names screens.)

**A5 is not a frontend step.** Persisting the view choice means a field on
`AppConfig`, which means writing under `src-tauri/` — a full rebuild, the app
restarts, the hotkeys go with it, and a dictation in flight is lost. It is
sequenced last for that reason, and it is the one step that needs
`cd src-tauri && cargo test`.

**`capture_integrity` is `null` more often than it looks.** It is absent on
retries and on every entry older than the measurement. Words per minute divided
by a summed `recorded_seconds` that silently skipped half the records is a
plausible, wrong number — the failure class `core-hardening.md` exists for. The
average is over what was measured, and the tile says so.

## The prompt for the next session

You are continuing the **home activity** track. Work in the repo root on `main`.
Do not create a branch. **Five other tracks work in the same tree** — see
[`../IMPLEMENTATION.md`](../IMPLEMENTATION.md) — so run `git status` and
`git log --oneline -5` before you start, and stage your own paths. Never
`git add -A`.

**A1 and A2 are landed.** Read the record above before anything else; it names
what exists, what it cost and two traps that are not in the tree's own comments.

**Read first:** this page in full, then
[ADR 0171](../decisions/0171-an-instruction-is-read-once-so-home-has-two-lives-and-a-counter-with-no-reading-is-dark-rather-than-zero.md),
`src/screens/Home.tsx`, `src/components/shell/DigitCounter.tsx` (the composite
frame you are about to draw a much bigger one beside),
`src/components/ui/matrix.tsx`, `src/lib/activity.ts` (where a reading is
derived, and where the calendar's day buckets belong too), ADR 0161, `CLAUDE.md`
and `docs/spec/SPEC.md`.

**Your unit is A3 and A4** — the calendar and its day tooltip. Not A5: it puts a
field on `AppConfig`, which means writing under `src-tauri/`, a full rebuild and
a dead dictation if one is in flight. Until A5 lands, **the block shows the tiles
and the calendar is not reachable from the product** — so mount it in the
gallery, on the Design System page beside the counter, and say so in your record.
Do not invent a temporary toggle to see your own work; a control that is not the
decided one is a control somebody will ship.

**A3 and A4 are done when all of this is true**, and not before:

- `@uiw/react-heat-map` is vendored under `src/components/ui/` with the
  provenance header `matrix.tsx` uses — source URL, commit, fetch date, local
  changes marked WORDSCRIPT — and is not a dependency in `package.json`.
- The cells are circles on the matrix ramp (`--fg-muted` unlit through four steps
  to `--accent`), via `rectRender`, not a fork.
- 26 weeks, and **the display grows with the installation** — a fresh install
  draws as many weeks as it has existed, filling rightwards. 365 grey cells on
  day one reads as a defect.
- A day's step comes from that day's dictation count, derived in
  `lib/activity.ts` under test, not in the screen.
- **The rendered SVG width is measured against its box**, not assumed from the
  CSS. See the second new trap; this is the step it was written for.
- The tooltip names a day's composition: dictations real, meetings and uploads
  present as preview lines that state they have no origin yet — never a zero,
  because a zero claims a count.
- The suite count moved by a number you can explain, and no case was deleted.

**The decisions on this page are made.** If one turns out to be wrong when it
meets the code, say so in your record and stop — do not quietly substitute a
different design.

**If you run short, stop after A3 and hand over.** A vendored, correct calendar
with no tooltip is a step; a calendar whose colours or growth rule are guessed is
a step somebody has to undo.

**Three rules with teeth here:**

1. **Never render a number the runtime did not produce.** A drawn reading carries
   `PreviewTag` and shows no figure at all — an invented 3 is worse than a
   visible gap, and this is the rule ADR 0161 exists for.
2. **A dev host may be running.** Check `pgrep -af "tauri dev"`. Do not write
   `vite.config.ts` while one is up, and batch anything under `src-tauri/`
   — a rebuild kills a dictation in flight.
3. **A capture measurement may be running** (runtime ownership step 6). Take
   `wc -l ~/.config/WordScript/logs/wordscript-runtime.log` before and after
   your checks and report both, and do not run heavy builds during one.

**Validation:** `npm test` and `npm run build`. Quote the suite count as a delta
against the baseline you measured at the start, and say what the difference is.
No `cargo` command unless you touched Rust — A3 and A4 should not. Run
`npm audit` if you vendor anything that pulls a dependency; the intent is that
nothing new lands in `package.json` at all.

**Before you stop**, write your record into this page above the sequence, update
the sequence rows you closed, and write the next session's brief in place of
this prompt.
