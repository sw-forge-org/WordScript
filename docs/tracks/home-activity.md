# The home activity track

Opened 2026-08-16. **Stage A is closed — A1 to A5 are all landed — and Stage B
row B3 went with it, because the owner asked for all-time counters and B3 is what
they need. B1, B2 and B4 remain, and each waits on another track.** Both the
orientation page and the sequence — start a session here.

Owns **ADR 0171–0180**.
[ADR 0171](../decisions/0171-an-instruction-is-read-once-so-home-has-two-lives-and-a-counter-with-no-reading-is-dark-rather-than-zero.md)
covers what A1 and A2 built;
[ADR 0172](../decisions/0172-an-unlit-cell-is-an-assertion-so-the-calendar-spans-what-the-record-can-vouch-for-and-nothing-more.md)
covers A3, A4 and A5 and closes Stage A;
[ADR 0173](../decisions/0173-the-calendar-draws-every-day-because-a-grid-that-hides-what-it-cannot-prove-reads-as-broken.md)
reverses one decision inside 0172 after the owner saw the result;
[ADR 0174](../decisions/0174-all-time-figures-need-a-record-that-does-not-forget-so-the-ledger-is-counts-per-day-and-never-text.md)
builds the activity ledger and **closes Stage B row B3**;
[ADR 0175](../decisions/0175-a-tile-may-only-report-what-the-runtime-can-see-so-apps-goes-turnaround-arrives-and-the-rate-is-a-median.md)
retires `Apps`, brings in Turnaround and makes the rate a median. **0176 is the
next free number** — but grep the tree before claiming it, because six tracks
share `main` and a number gets cited in source before its file lands.

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

**Words per minute** · **Time saved** · **Apps** · **Languages**.

Read left to right they make a sentence: *this is how fast you speak, this is
what it gives you back, everywhere, in these languages.*

**Superseded in two places by
[ADR 0175](../decisions/0175-a-tile-may-only-report-what-the-runtime-can-see-so-apps-goes-turnaround-arrives-and-the-rate-is-a-median.md).**
`Apps` is unwireable — the target application is only resolved on a direct paste,
and 49 of 50 real dictations were clipboard deliveries — so it is replaced by
**Turnaround**, the median wait from speaking to text. And the rate is a
**median** rather than an average, because an aggregate is dragged down by long
dictations and a mean is dragged up by short hallucinated ones. The sentence
becomes: *this is how fast you speak, this is what it gives you back, this is how
quickly it answers, in these languages.* Time saved is windowed to four weeks;
everything else is all time.

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

## The record — A3, A4 and A5, 2026-08-16

Session two, same day. Unit was the whole rest of Stage A, and all three steps
landed. Durable form is in
[ADR 0172](../decisions/0172-an-unlit-cell-is-an-assertion-so-the-calendar-spans-what-the-record-can-vouch-for-and-nothing-more.md);
what is here is what the next session needs.

**What landed.** `@uiw/react-heat-map` @ `86a3d0b` vendored into
`src/components/ui/heat-map.tsx` — MIT, flattened to one file, provenance header,
local changes marked WORDSCRIPT, **not** in `package.json`.
`ActivityCalendar` (`components/shell/`) draws it as circles on the matrix ramp
with the day tooltip. Four new derivations in `lib/activity.ts` — `dayKey`,
`activityDays`, `activityStep`, `activityWindow`. `HomeSwitch` in `HomeHero.tsx`,
`AppConfig.home_activity_calendar` in Rust, and a gallery section on the Design
System's Motion page beside the counter.

**Suite: 697 → 731 over 48 → 49 files, then 731 → 730 when the owner reversed
one decision.** Thirty-four cases added and none deleted on the first pass;
the reversal then deleted the two that pinned the narrowing grid and added two
asserting the opposite, plus one for the clipping bug, and merged two assertions
into one case. **Deleting a case for a design that no longer exists is the one
legitimate reason to lose one** — it is not the same act as deleting a case to
make a step green. `npm run build` clean, `npx tsc --noEmit` clean,
`cd src-tauri && cargo test` **879 passed, 0 failed, 6 ignored**.

**One Rust pass, announced before it happened.** A dev host was running the whole
session (`pgrep -af "tauri dev"` → PID 392439). `config.rs` was written once, the
app rebuilt and restarted once, and nothing under `src-tauri/` was touched again.
Runtime log 6343 → 6469 lines, which is that host's own output; no capture
measurement was in flight at either end (checked, and `cargo test` was held until
it was clear).

### The finding that changed A3, and it is the reason to read this section

**A 26-week calendar cannot be built honestly from `history.json`, and the
prototype's growth rule was measuring the wrong clock.**

Decision 7 says the calendar grows with the *installation*. It cannot: nothing in
the frontend knows when the install happened. What it can know is **how far back
the record still reaches**, and that is the honest clock — history is pruned on
every read by two arms, and the second one is easy to miss:

- `history_retention_days` drops anything older than the horizon.
- `history_limit` drops the oldest records once the file is full, **whatever
  their age**. So a saturated history cannot vouch for any day before its own
  oldest record, even one well inside the retention horizon.

**On the owner's machine, measured:** `history_limit: 50`,
`history_retention_days: 7`, fifty records held, every one of them from a single
day. A naive 26-week display would have painted **181 confident grey circles**,
each one asserting *you did not dictate that day* about a day whose records were
simply thrown away, around one lit one.

`activityWindow` takes the narrowest of the three bounds and names which one bit.

**The first build then went one step too far with that, and the owner reversed it
on sight — see [ADR 0173](../decisions/0173-the-calendar-draws-every-day-because-a-grid-that-hides-what-it-cannot-prove-reads-as-broken.md).**
It narrowed the GRID to the window and drew the rest as blank space, which on a
seven-day history produced a four-column box with one column of circles in it.
That does not read as *the record cannot vouch for more*; it reads as *this
software is broken*. And the premise was weaker than it sounded: a run of unlit
days is not an accusation, it is a half-year filling up, and watching it fill is
most of the reason to look. **The grid is constant now**, every day gets a circle,
and the reach is one plain line underneath — a fact about the history file rather
than a caveat about the drawing. The lesson worth carrying: when a display would
have to hide something to stay strictly honest, the honest thing is usually a
caption, not a gap.

**What this means in practice:** on a history pruned to seven days the calendar
draws its full half-year and says underneath that the records only go back a
week. Raising `history_limit` and `history_retention_days` fills it from that day
forward and recovers nothing already dropped. The durable answer is **Stage B row
B3**, and this is the evidence for why it is worth its cost. Stage A was told to
take the window labels and it took them; B3 is still open and this session did not
pre-empt it.

### Three defects the owner caught by looking, after the suite was green

All three shipped past a full green suite and two rounds of browser measurement,
which is the useful part of recording them.

1. **The grid narrowed itself into looking broken** — reversed, above and in
   ADR 0173.
2. **The month labels were painting `#24292e` in both schemes.** The vendored heat
   map sets `color: var(--rhm-text-color, #24292e)` as an INLINE style on the
   `<svg>` and `textStyle` fills from `currentColor`, so an inline style was
   beating every rule in `shell.css`. Fixed by defining `--rhm-text-color` on
   `.ws-cal`, which is upstream's own hook — reaching a vendored component through
   the variable it publishes rather than patching over it from outside.
3. **Every circle was clipped, and it was reported as "why is that only a
   three-quarter circle".** `Day` already wraps each cell in
   `translate(5, 20)`, so `cellProps.x`/`y` are relative to the padded origin;
   adding the pads again in the render override pushed the last column and bottom
   row past the viewBox edge. **A clipping bug names the wrong object in its own
   symptom.** A case now asserts that no cell's bounding circle crosses the
   viewBox on any side.

### Two corrections to what was written before

**ADR 0171's trap note has the cascade backwards, and the calendar proved it.**
The note says an SVG presentation attribute beats every rule in `shell.css`
because it is unlayered. Measured: `.ws-win svg { width: 16px; height: 16px }` —
the unscoped prototype rule — rendered the 470 px calendar at **16 × 4.86 px**,
aspect ratio intact and size gone. Presentation attributes sit in their own layer
*below* all author layers, so any rule beats them. What actually beat the
counter's rule was narrower: the attribute sets `width` where that rule only set
`max-width`. The Traps section now carries the corrected version.

**The tiles' `Words per minute` measures throughput, not speech.** Investigated
on the owner's suspicion that 74 wpm was too low, and the suspicion was right in
substance though not in the way expected — the arithmetic is correct and the
claim is not. Full derivation below, under *What the readings actually measure*.

### One number the next session inherits

**470 px is 26 columns and the arithmetic is `5 + 26 × (15 + 3) − 3`.** The cap is
a **column count**, not a day count: 182 days ending mid-week touch twenty-seven
calendar weeks, and twenty-seven columns is 488 px. The height is 143 px.
Measured in a browser at 1000 px and at 720 px viewport, against the box, per
A3's own brief — and the measurement found two real defects that reading the CSS
would not have.

## What the readings actually measure

Investigated 2026-08-16 on the owner's challenge: *I don't believe I have a
words-per-minute count of 74 — prove me wrong.* **The challenge was right and the
tile was not lying; the tile was measuring something other than what its name
suggests.** Computed against the fifty real records in `history.json`.

**The arithmetic checks out.** 2,898 words over 2,217.5 recorded seconds is
**78.4 wpm** aggregate, over 49 of 49 countable runs. The 74 the owner saw is the
same figure on a slightly different set — history rotates. Nothing is invented
and no denominator was skipped.

**The denominator is the open microphone, not the speech.**
`capture_integrity.recorded_seconds` is `samples / (rate × channels)` — the whole
capture window, from starting the capture to ending it. It therefore contains the
pause before you begin, every pause while you think, and the tail before you
stop. The signature is unmistakable in the data:

| Dictation length | Runs | Aggregate wpm |
|---|---|---|
| under 5 s | 12 | 110.3 |
| 5–15 s | 10 | 98.2 |
| 15–60 s | 11 | 89.7 |
| 60–120 s | 9 | 86.9 |
| over 120 s | 7 | **67.7** |

A rate that falls monotonically with duration is silence entering the
denominator, and runs of 60 s and over carry **81 % of all recorded seconds**.
So the tile is dominated by long dictations and reads about 78 where the owner's
articulation rate is nearer 110–130. **It is a throughput figure — words
delivered per minute of open microphone — and the tile's tooltip now says so.**

**Two smaller contaminations, both real, neither large:**

- **The numerator is words *kept*, not words said.** It reads
  `transformed_transcript ?? raw_transcript`, and cleanup removes filler: 2,948
  raw words became 2,898 transformed, −1.7 %. Small, systematic, and in the
  honest direction.
- **A short capture can inject words that were never spoken.** One record holds
  *"Alright, come with me and go to the next one"* — ten words — against
  `recorded_seconds: 1.97`. That is 273 wpm and physically impossible; it is a
  recogniser hallucination on a two-second clip, and it lands in the numerator at
  full weight. **This belongs to [`core-hardening.md`](core-hardening.md)**, whose
  whole subject is fluent-and-wrong output, and it is noted here only because
  this is where it was found.

**What was changed, and what deliberately was not.** The tile's tooltip now
states that the clock runs from capture start to capture end, that the thinking
pause is in the denominator, and that the figure reads lower the longer the
dictation. **The label and the tile set were not touched** — decision 4 is made,
and renaming a tile is re-opening it rather than building it. If the owner wants
a true articulation rate it needs speech-seconds rather than stream-seconds, the
runtime already has a `voice_threshold_dbfs` concept in `input_level`, and that
is a new Stage B row rather than a tooltip edit.

**Time saved inherits the same denominator** and is otherwise sound: it is
explicitly an assumption against a 40 wpm typing baseline, rendered with `≈`, and
windowed to seven days. Understating the seconds spoken would overstate the
saving; here the seconds are overstated, so **time saved is conservative** —
which is the right direction for a figure derived from a guess.

## The record — the owner's four corrections, 2026-08-16

Same day, same session, after the first Stage A close. **Everything here came
from the owner looking at the running app**, and every one of the four was right.
Recorded separately because the pattern matters more than the fixes: a full green
suite and two rounds of browser measurement did not catch any of them.

**1. The grid hid what it could not prove, and that read as broken.** Reversed —
[ADR 0173](../decisions/0173-the-calendar-draws-every-day-because-a-grid-that-hides-what-it-cannot-prove-reads-as-broken.md).
The grid is always twenty-six weeks and every day gets a circle. *When a display
would have to hide something to stay strictly honest, the honest thing is usually
a caption, not a gap.*

**2. The month labels were `#24292e` in both schemes.** The vendored heat map
sets `color: var(--rhm-text-color, #24292e)` as an INLINE style on the `<svg>`,
which beats every rule in `shell.css`. Fixed through upstream's own hook —
`--rhm-text-color: var(--fg-dim)` on `.ws-cal` — rather than by patching over the
inline style from outside. Verified computed: `rgb(194, 191, 184)` on dark,
`rgb(85, 80, 74)` on light.

**3. "Why is that only a three-quarter circle?"** Every cell was clipped. `Day`
already wraps each cell in `translate(5, 20)`, so the pads were applied twice and
the last column and bottom row fell outside the viewBox. **A clipping bug names
the wrong object in its own symptom** — nobody reports "the grid is offset", they
report the shape. A case now asserts no cell's bounding circle crosses the
viewBox on any side.

**4. Both views centred; weekday labels; the tooltip over the sidebar; all-time
counters.** The first three are layout. The fourth was not: see below.

### The ledger, and why it stopped being a Stage B row

All-time counters cannot come from history — that is ADR 0172's whole finding —
so the owner asking for them **is** B3. It was built rather than deferred:
`core::activity_ledger`, one row per day, counts and durations, never text.
[ADR 0174](../decisions/0174-all-time-figures-need-a-record-that-does-not-forget-so-the-ledger-is-counts-per-day-and-never-text.md)
carries the derivation.

- Written at `history::record_entry_with_work_mode`, the funnel every path
  already reaches. **A retry is not counted** — it re-runs a transform over words
  already counted.
- **Seeded once** from whatever history still holds. On this machine it recovered
  52 dictations and 3,106 words, and reported **81.9 wpm all time**.
- A failed write is logged and swallowed; a corrupt file is replaced. Derived
  bookkeeping must never fail a dictation.
- `started_on` is the first row it ever wrote — the closest thing to an install
  date this product has, which makes decision 7's *grows with the installation*
  literally implementable.

**Time saved stays windowed at four weeks**, at the owner's direction: a lifetime
time-saved is a trophy, four weeks is a fact about your month. Four weeks rather
than a calendar month so it never jumps because February is short.

**`lib/activity.ts` lost seven history-reading functions and their cases.** They
were superseded, not inconvenient — leaving them would have shipped two ways to
compute one figure. Word counting moved into Rust, where it happens once per
record instead of on every render.

**Suite at the close: 728 frontend cases over 49 files, 886 Rust cases.**
`npm run build` clean, `npx tsc --noEmit` clean. Two Rust passes this session,
both announced: the config field, then the ledger.

## The record — the metrics session, 2026-08-16

Third and last session of the day, driven entirely by the owner reading the
running app. It produced one governing rule, and the rule is the part worth
carrying forward:

> **A tile may only report what the runtime can observe. Anything downstream of
> the insert is invisible.**

It has now decided four things — decision 6's *time until the text is with you*,
`Apps`, a proposed *first time right*, and Turnaround's own definition — and it
will decide the next one the same way.

**`Apps` is retired, not deferred.** The target application is only resolved on a
direct paste, and **49 of this machine's last 50 dictations were
`clipboard_only`**. A `PreviewTag` promises a reading once a field exists; this
one had no such future, so leaving it tagged would have been a promise the
product cannot keep. Its case now asserts the tile's absence.

**The first replacement proposed was wrong, and the owner caught it in one
sentence.** *First time right* — the share of dictations needing no correction —
can see retries and edit-overlay opens and cannot see the reader fixing three
words in their own editor. It would have read 94 % while the truth was worse: a
plausible wrong number produced by the very rule meant to prevent them.

**Turnaround took the slot on merit.** Median milliseconds from the audio
arriving to the text existing — both ends inside the runtime, identical on the
clipboard path and the direct one. It is the only tile that answers to a setting:
change the model, the lane or the profile and it moves, which is what makes it
possible to tell whether a change helped rather than remembering how last week
felt. The runtime had always measured it and thrown it away; what was missing was
a field on the record.

**The rate is a median now**, and the three candidates were not close: aggregate
82.7, mean of per-run rates 95.3, median 87.6. An aggregate is dragged down by
long dictations, which carry 81 % of all recorded seconds and are mostly thinking
pauses; a mean is dragged up by the two-second capture the recogniser invented
ten words for. Both medians are backed by fixed four-hundred-bucket histograms in
the ledger.

**One bug shipped and was caught on the running app: a histogram read off the
wrong axis.** A file written at five wpm per bucket, read at one, reported a
median of **17** where the truth was **88** — bucket 17 stopped meaning *85 to 90*
and started meaning *17*. The bucket width is now stored beside the counts and a
mismatch discards them. **A histogram without its axis is a plausible wrong
number waiting to happen**, and it is the third time this session that a derived
value was misread rather than missing.

**The copy was cut hard, at the owner's direction.** The tooltips had grown into
paragraphs and the feet printed `1 of 2 runs timed` beside every figure. That
count is a fact about the measurement rather than about the reader; the scope is
the part that changes how a number is read, so the feet are now `median · all
time`, `≈ minutes · last 4 weeks`, `ms · median · all time` and nothing else. The
calendar's line lost its second half for the same reason — how far the record
reaches is a fact about a settings value, and a calendar is not where anybody
asks for one.

**Suite at the close: 729 frontend cases over 49 files, 888 Rust cases.**
`npm run build` and `npx tsc --noEmit` clean.

## The sequence

**Stage A — the surface, on what already reads.** Nothing here is blocked.

| Step | What | Done means |
|---|---|---|
| **A1 · done** | The digit counter component: composite frame from `digits`, four reserved positions, right-aligned. Gallery entry. | It renders 7 and 1,240 without the box changing width |
| **A2 · done** | The four tiles on Home, **and the empty state in the same step**. Keycaps out — `KeyCap`, `keyCaps()` and the cap style block are Home-only and went entirely. The shortcut moved into the hero's fact line as the small `Keycaps` (the one `Context.tsx` uses). | Words per minute and time saved read from history; apps and languages carry `PreviewTag`; **a profile with no dictations sees the instruction, not four zeroes** |
| **A3 · done** | The calendar, vendored and converted to circles on the matrix palette, 26 weeks, growing with the install. **The growth clock turned out to be the history file, not the install** — see the record. | A day's colour steps with that day's dictation count |
| **A4 · done** | The day tooltip. Dictations real; meetings and uploads present as preview lines. | Hovering a day names its composition |
| **A5 · done** | The switch, its indicator, and persistence. `AppConfig.home_activity_calendar`, additive, on `workspace_nav_rail`'s shape. | The choice survives a restart |

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
| **B3 · done** | Lifetime counters that survive pruning — `core::activity_ledger`, one row per day, counts only ([ADR 0174](../decisions/0174-all-time-figures-need-a-record-that-does-not-forget-so-the-ledger-is-counts-per-day-and-never-text.md)) | this track |
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

**AN SVG'S SIZE IS DECIDED BY A FIGHT BETWEEN THREE THINGS, AND THE UNIT SUITE
CANNOT SEE ANY OF IT — CORRECTED, A3.** The original form of this trap said an
SVG presentation attribute *beats every rule in `shell.css` because it is
unlayered*. **That is backwards, and A3 proved it by shipping a 470 px calendar
that rendered at 16 × 4.86 px** — aspect ratio intact, size gone. Presentation
attributes sit in their own layer BELOW all author layers, so any author rule
beats them; the 16 px came from `.ws-win svg { width: 16px; height: 16px }`, the
unscoped prototype rule at the top of the file. What actually beat `.ws-counter`'s
rule in A1 was narrower than the note claimed: the attribute sets `width`, and
that rule only set `max-width`. The working form is `.ws-matrix-wrap svg`'s —
**state the width, then let `max-width` shrink it.**

Two more, both found by measuring and neither visible in jsdom:

- **A `place-items: center` grid sizes its column to the item's max-content**, so
  `max-width: 100%` on the item resolves to the item's own width and caps
  nothing. The calendar overflowed a 398 px stage at full 470.
- **A grid or flex item's automatic minimum size is its min-content.** Without
  `min-width: 0` the block refuses every box narrower than the display inside it,
  whatever the host declares. It is the COMPONENT's job to carry that, or every
  future host has to know it.

jsdom applies no stylesheet, so all three were found by rendering in a browser and
measuring `getBoundingClientRect()` against the box. **Measure it; do not read the
CSS and believe it.**

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

**`recorded_seconds` IS THE OPEN MICROPHONE, NOT THE SPEECH — and every reading
built on it inherits that.** It is `samples / (rate × channels)`: the whole
capture window, thinking pauses included. So `wordsPerMinute` is throughput and
not articulation, it falls monotonically with dictation length (110 wpm under 5 s,
68 wpm over 120 s on real records), and long dictations dominate it because they
carry 81 % of all recorded seconds. **Anything day-scoped or rate-shaped that a
later step adds will inherit the same denominator**, so name it accordingly or
derive speech-seconds first. Full derivation in *What the readings actually
measure* above.

**A HISTORY FILE IS NOT AN APPEND-ONLY LOG, AND THE CALENDAR IS THE SURFACE THAT
FORGETS IT.** Pruning has two arms and the count arm is the one that catches
people: a saturated history cannot vouch for any day before its own oldest
record, even one inside the retention horizon. Any future surface that draws
absence — a streak, a gap, a "you haven't dictated since" — has to pass through
`activityWindow` or it will state a fact the file cannot support. **`0` and
`unknown` are different, and so are `unlit` and `not drawn`.**

## The prompt for the next session

**Stage A is closed.** A1 to A5 are landed and
[ADR 0172](../decisions/0172-an-unlit-cell-is-an-assertion-so-the-calendar-spans-what-the-record-can-vouch-for-and-nothing-more.md)
is the record. Read the two record sections above before anything else — the A3/A4/A5
one and *What the readings actually measure* — because both carry findings that
are not in the tree's own comments.

Work in the repo root on `main`. Do not create a branch. **Five other tracks work
in the same tree** — see [`../IMPLEMENTATION.md`](../IMPLEMENTATION.md) — so run
`git status` and `git log --oneline -5` before you start, and stage your own
paths. Never `git add -A`. **0176 is the next free ADR number unless the tree says
otherwise — grep, do not trust this line.**

### Stage B is what is left, and four of its five rows are not yours to start

Every row below waits on another track's data. **Do not build the surface for a
row whose data has not landed**; a drawn tile with no field behind it is the thing
this track spent Stage A making impossible. The table under *What can be wired
today* is still the authority on which is which.

**The one row this track owns outright is B3**, and Stage A produced the evidence
for it:

> **B3 — a per-day aggregate that survives pruning.** The calendar can only draw
> what `history.json` still holds, and on the machine this was built against that
> is a single column. A ledger of counts per day — no text, no app names, one row
> per day, bounded at a year or so — makes the 26-week display honest and makes
> decision 7's *grows with the installation* literally true, because the ledger's
> own first day IS the install date. It is Rust, it is a new persistent
> collection, and it needs a privacy line even though it stores only counts.
>
> **Sequence it as its own unit with its own Rust pass.** Stage A's A5 pass is
> spent; do not bolt this onto an unrelated one.

Before starting B3, put one question to the owner: **their `history_limit: 50`
and `history_retention_days: 7` may simply be leftovers from testing.** The
defaults are 200 and 90. If they raise them, the calendar is worth looking at
again from that day forward, and B3's urgency changes — not its correctness.

### A second thing worth raising, and it is not a Stage B row yet

**`Words per minute` is throughput, not articulation.** Stage A widened the
tooltip to say so and deliberately left the label and the tile set alone, because
decision 4 is made. If the owner wants a true speaking rate it needs
**speech-seconds rather than stream-seconds** — the runtime already computes a
`voice_threshold_dbfs` in `input_level`, so the concept exists but nothing sums
voiced time per capture. That is a runtime change and a new row; **propose it, do
not quietly build it.**

Related and not this track's: a two-second capture produced ten words
(*"Alright, come with me and go to the next one"*), which is a recogniser
hallucination landing in a real reading at full weight.
[`core-hardening.md`](core-hardening.md) owns it.

### Rules that still have teeth here

1. **Never render a number the runtime did not produce.** A drawn reading carries
   `PreviewTag` and shows no figure at all (ADR 0161).
2. **`unlit` and `not drawn` are different claims**, and so are `0` and `unknown`.
   Anything that draws absence goes through `activityWindow`.
3. **A dev host may be running.** Check `pgrep -af "tauri dev"`. Do not write
   `vite.config.ts` while one is up, and batch anything under `src-tauri/` into
   one pass — say out loud that a rebuild is coming before you do it.
4. **A capture measurement may be running.** Take
   `wc -l ~/.config/WordScript/logs/wordscript-runtime.log` before and after and
   report both; no heavy builds, `cargo test` included, during one.
5. **Measure geometry in a browser, do not read `shell.css` and believe it.**
   Stage A's corrected trap is three separate ways that goes wrong.

**Validation:** `npm test`, `npm run build`, and `cd src-tauri && cargo test` if
Rust moved. Quote the counts as a delta against the baselines you measure at the
start. Baselines at the close of this session: **729 frontend cases over 49
files, 888 Rust cases.** Run `npm audit` if anything lands in `package.json`; the intent is
that nothing does.

**Before you stop**, write your record into this page above the sequence, update
the rows you closed, write the next ADR in the track's range, and write the next
brief in place of this prompt.
