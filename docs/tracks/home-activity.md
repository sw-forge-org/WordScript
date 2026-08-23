# The home activity track

Opened 2026-08-16. **Stage A is closed — A1 to A11 are all landed. Stage C
opened 2026-08-17 from an owner brief and is closed the same day: C1 to C11 are
landed and C12 was withdrawn. Stage B row B3 went with Stage A, because the owner
asked for all-time counters and B3 is what they need. B1, B2 and B4 remain, and
each waits on another track.** Both the orientation page and the sequence — start
a session here.

Owns **ADR 0171–0184 and 0186–0197** — 0185 went to the privacy work. **0198 is
the next free number**, and 0196 and 0197 are two readings that came out of the
same owner session but are not Home's: the window's status strip and the Profiles
screen. They are here because this track was in the tree and no other track
claims either surface.
[ADR 0171](../decisions/0171-an-instruction-is-read-once-so-home-has-two-lives-and-a-counter-with-no-reading-is-dark-rather-than-zero.md)
covers what A1 and A2 built;
[ADR 0172](../decisions/0172-an-unlit-cell-is-an-assertion-so-the-calendar-spans-what-the-record-can-vouch-for-and-nothing-more.md)
covers A3, A4 and A5 and closes Stage A;
[ADR 0173](../decisions/0173-the-calendar-draws-every-day-because-a-grid-that-hides-what-it-cannot-prove-reads-as-broken.md)
reverses one decision inside 0172 after the owner saw the result;
[ADR 0174](../decisions/0174-all-time-figures-need-a-record-that-does-not-forget-so-the-ledger-is-counts-per-day-and-never-text.md)
builds the activity ledger and **closes Stage B row B3**;
[ADR 0175](../decisions/0175-a-tile-may-only-report-what-the-runtime-can-see-so-apps-goes-turnaround-arrives-and-the-rate-is-a-median.md)
retires `Apps`, brings in Turnaround and makes the rate a median; ADR 0176
through [ADR 0182](../decisions/0182-a-counters-basis-belongs-under-the-figure-and-the-preview-path-is-not-the-park.md)
are the correction passes A6 and A7, and
[ADR 0183](../decisions/0183-the-calendar-is-a-year-you-scroll-through-and-a-period-it-can-speak-for.md)
gives the calendar its year picker, its scroll and its legend (A8), and
[ADR 0184](../decisions/0184-a-list-is-paged-and-a-screen-offers-what-it-used-to-recite.md)
adds the manual switch and pages History (A9);
[ADR 0186](../decisions/0186-a-tile-explains-itself-everywhere-and-only-german-was-a-claim-the-record-never-made.md)
and [ADR 0187](../decisions/0187-a-ramp-whose-every-real-value-is-the-maximum-is-not-a-ramp.md)
are A10, and
[ADR 0188](../decisions/0188-one-call-names-the-file-and-the-language-and-it-stands-behind-the-insert.md)
is A11.
[ADR 0189](../decisions/0189-a-marker-is-a-day-with-a-name-and-it-never-joins-the-ramp.md)
through
[ADR 0197](../decisions/0197-a-profile-is-made-active-where-profiles-are-managed.md)
are the whole of Stage C — markers and the left arrow (0189), the install date
(0190), the counter's decimal point (0191), the standing facts moving back to the
top (0192, **which reverses 0171**), the delivery badges (0193), the row's
overflow menu (0194, **which qualifies 0082**), the undo window (0195, **which
departs from 0082**), the status strip and the lock line (0196), and *Set as
active* on Profiles (0197). **0198 is the next free number** — but grep the tree
before claiming it, because eight tracks share `main` and a number gets cited in
source before its file lands.

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
| **Words per minute** | **yes, and rebuilt** | SPOKEN words (`raw_transcript`) over SPEECH seconds — the recorded window less the thinking pauses, measured in the audio callback ([ADR 0177](../decisions/0177-a-rate-that-counts-a-models-words-over-an-open-microphone-is-not-a-speaking-rate.md)). The first build divided delivered words by the open microphone, which reported how verbose the model is over how long somebody left the microphone on |
| **Time saved** | **yes, and rebuilt** | `saved_words / baseline − saved_seconds / 60`, over the runs that carried a clock AND did not generate their own text ([ADR 0178](../decisions/0178-time-saved-may-only-credit-what-somebody-would-have-typed-and-the-baseline-is-the-readers-to-set.md)). The baseline is a setting now, because it swings the figure threefold across the range a real writer types at |
| **Longest dictation** | **yes** | max `recorded_seconds` |
| **Dictations per day** | **yes** | `created_at_ms` |
| **Apps** | **no** | `core::workspace_context` already resolves `app_name`, `bundle_id` and `category` for the transform context, but **no history field stores it**. Needs a field, and a privacy decision — recording which applications a person dictates into is a new collection, and the retention rule has to name it (ADR 0138's shape) |
| **Languages** | **yes, by a different route** | B1's plan — pass `response.language` through — was measured and delivers nothing: Groq reports `reports_detected_language: Unsupported` and the local lane has no field for it, so on the two lanes most dictations take, nothing would ever arrive. Measured on the DELIVERED TEXT instead, in the runtime, offline ([ADR 0180](../decisions/0180-the-lane-that-most-dictations-take-never-names-a-language-so-the-language-is-measured-on-the-text.md)). Still tied to the core-hardening record where a German dictation returns in English — it now makes that defect countable |
| **Meetings, uploads in the calendar** | **no** | origins that do not exist. [`context-objects.md`](context-objects.md) owns them; the calendar reserves the tooltip lines and shows them only once an origin can produce one |
| **Anything lifetime-scoped** | **yes** | `core::activity_ledger`, and since [ADR 0176](../decisions/0176-a-lifetime-figure-that-can-fall-is-not-a-lifetime-figure-so-a-pruned-day-is-retired-and-only-a-button-clears-it.md) a pruned day is RETIRED into the totals rather than dropped, so no figure can fall. It is in the full backup and merges by field-wise maximum ([ADR 0179](../decisions/0179-the-ledger-is-the-only-thing-in-an-archive-that-cannot-be-rebuilt-so-a-restore-raises-it-and-never-replaces-it.md)), and the one control that clears it is a red button in Privacy & Data |
| **Turnaround** | **yes, and corrected twice** | Measured from the capture STOPPING rather than from the audio file already existing, so the encode is inside the figure ([ADR 0181](../decisions/0181-the-wait-starts-when-you-stop-speaking-not-when-the-file-is-already-written.md)). The value was also being dropped on the floor by `history_entry_from_insert_result`, which is why the tile was dark on a machine with sixty dictations in it — and then a second time by the preview commit, which is the path EVERY dictation takes when the profile does not auto-paste ([ADR 0182](../decisions/0182-a-counters-basis-belongs-under-the-figure-and-the-preview-path-is-not-the-park.md)) |

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

## The record — Stage C, 2026-08-17

Fourth session. Unit was the whole of Stage C plus three readings the owner added
by voice while it ran; **C1 to C11 all landed and C12 stays withdrawn**. Durable
form is in
[ADR 0189](../decisions/0189-a-marker-is-a-day-with-a-name-and-it-never-joins-the-ramp.md)
through
[ADR 0197](../decisions/0197-a-profile-is-made-active-where-profiles-are-managed.md);
what is here is what the next session needs.

**Suite: 788 → 806 over 49 → 50 files, and 917 Rust cases unchanged.** Eighteen
frontend cases added, none deleted; twelve were rewritten in place against facts
that moved. `npm run build`, `npx tsc --noEmit` and `cd src-tauri && cargo test`
all clean. One Rust pass, announced before it happened — a dev host was running
the whole session (PID 1050932) and `activity_ledger.rs` was written once.
Runtime log 14,490 → 15,186 lines at the announcement, which is that host's own
output; no capture measurement was in flight.

### The three things the owner reported while the session was running

All three came from using the running app, and **two of them were defects in what
this session had just built** — which is the useful part.

1. **The decimal point was unreadable, and `1.0` read as `10`.** Both halves are
   one mistake. A single lit cell at the foot of the ordinary one-column gap is
   four pixels of ink on a display made of four-pixel dots, and the gap it sat in
   was IDENTICAL to the gap between every other pair of digits — so the eye had
   nothing to group by. **The separation is the signal and the dot only confirms
   it**: the gap is three columns now and the mark is 2 × 2.
2. **Then the mark merged with the digit after it.** Same failure one step
   smaller. The point takes the first two columns of the gap and leaves one clear
   column before the digit it qualifies; it stays hard against the digit on its
   LEFT, which is where a decimal point belongs.
3. **A profile could not be made active from the screen that manages profiles.**
   Not a defect this session introduced — it has been true since Leg 7 — and it
   is [ADR 0197](../decisions/0197-a-profile-is-made-active-where-profiles-are-managed.md).

**Two of the three were about six pixels of a glyph**, and neither was findable
by reading the code or by any unit case: the frame arithmetic was correct at
every step. The rule this adds to the Traps section is that **a matrix glyph is
graded by looking at it at its real size**, in the same family as the geometry
trap A3 already carries.

### Two rows that depart from a standing ADR, and both say so by number

- **C8 reverses ADR 0171** — [ADR 0192](../decisions/0192-the-standing-facts-go-back-to-the-top-and-this-reverses-0171.md).
  0171 was right about the 42 px keycaps and wrong about the line, and they are
  not the same object: the caps were an INSTRUCTION, and the fact line is *what
  is about to happen when I press it*, which is a question a reader has every
  day.
- **C11 departs from ADR 0082's *deleting always asks*** —
  [ADR 0195](../decisions/0195-a-transcript-delete-gets-an-undo-window-instead-of-a-confirm.md),
  for this one object and no other. A transcript row is deleted often and in
  runs, and a confirm that is clicked through is not a safety net.

**C10 qualifies ADR 0082 rather than departing from it** —
[ADR 0194](../decisions/0194-what-stays-an-icon-is-what-you-repeat-and-on-a-transcript-row-that-is-copy.md).
Its icon rule was written for a list you REORDER; read literally it would send
all six verbs into the menu on a list that has no reorder at all. The rule's own
reasoning selects `Copy`, because a transcript row is a record you take text out
of repeatedly.

### The two C3 questions, answered

Both were flagged as *do not guess* by the previous brief, and both are in
[ADR 0190](../decisions/0190-the-install-date-is-a-ledger-field-because-a-config-field-would-be-somebody-elses-install.md).

- **What an existing install stamps.** The config file's creation time first —
  it is written on the first launch and predates any dictation — then
  `started_on`, then nothing. `created()` is `Err` on filesystems with no birth
  time and that is a refusal, not a reason to fall back to `modified()`, which
  reads the last config WRITE. **A missing marker costs nothing; a wrong one
  costs the display its credibility.**
- **What *earliest wins* means.** *When you first installed WordScript*, not
  *when this machine got it* — because that is what `raise_to` already
  implements, and **a field whose label and whose merge rule disagree is a field
  that lies on exactly the machines where it matters.** The marker says
  `WordScript installed`.
- **The reset does not clear it**, as recommended. That button is about what was
  RECORDED, and a date that has passed cannot be measured again the way a count
  can be rebuilt by living another day.

### One number the next session inherits

**The Turnaround tile is two columns wider than its three neighbours** — 25
columns against 23, 148 px against 136 — because the decimal gap costs two. The
dot pitch is identical, the grid track has the room, and the tile is centred in
it. If a second tile ever takes a decimal, the row's four tracks are still
`1fr` each and nothing has to move.

## The record — Stage D, 2026-08-18

Fifth session. One owner reading of the running Home screen opened it, and every
item in it is frontend: **no Rust, no ledger field, no migration.** Durable form
is
[ADR 0233](../decisions/0233-a-window-that-has-not-filled-says-how-full-it-is-and-a-figure-that-outgrows-its-unit-changes-unit.md)
and
[ADR 0235](../decisions/0235-a-metric-opens-its-own-view-of-the-home-block-and-it-draws-only-what-its-record-can-carry.md);
what is here is what the next session needs.

**Suite: 898 → 935 over 53 → 56 files.** Three new files (`series.test.ts` 10,
`MetricDetail.test.tsx` 5, `MetricChart.test.tsx` 8) and fifteen cases added to
three existing ones, one rewritten in place because the behaviour it asserted
deliberately changed. `npx tsc --noEmit` and `npm run build` clean. **Rust was
not touched and `cargo test` was not run** — nothing under `src-tauri/` moved, so
there was nothing for it to prove. No dev host was running and no capture
measurement was in flight.

### The reading that opened it, and the second defect inside it

The owner read the tile three days into the record: **this feature has only
existed here for three days, so the *last four weeks* have saved 200 minutes.**

The complaint is the label. **The defect the complaint contains but does not
name is the unit**: the same tile has no ceiling, and `DigitCounter` reserves
four positions, so a heavy month would have widened the tile and handed the
reader `4820 minutes`. The owner named both thresholds — 180 minutes, then 72
hours — and both are about the unit a person has a feel for rather than about
the width of the box. **The ladder is deliberately earlier than the mechanical
limit** (ADR 0233).

**`installed_on` is not the ramp's basis, and it looked like it should be.** On
the reporting machine it says `2026-04-01` while the first day row says
`2026-08-16` — the install predates the ledger by four months. A ramp on
`installed_on` would have reported a full four-week window on a three-day record
and reproduced the exact defect it was written to fix. `ledgerFirstDay` reads
`started_on` and falls back to the earliest row.

### The four metrics do not have the same record behind them, and two of them have no history at all

This is the finding that shaped the whole detail view. Day rows carry `saved_*`
and `spoken_words`/`speech_seconds`, so **time saved and words per minute fold
over any span**. They carry no turnaround and no language: those exist only as
all-time histograms and an all-time map. **There is no per-period turnaround
anywhere in the file**, and a `Months` tab over it would have to invent one.

So those two draw what they do have — the spread with its median column marked,
the shares per language — and say in one line that it is a spread rather than a
history. **Which is the more useful sentence anyway**: what moves the turnaround
is the model and the lane, so a change there shows up as a second hump before it
shows up in the median.

### Five defects the suite could not see, and one browser page that found all of them

The four views were rendered in a throwaway Vite page against a synthetic
ninety-day ledger — the same technique as measuring geometry in a browser, one
step up: not *is this the right width* but *is this chart a lie*. Every one of
these was green in Vitest and wrong on the screen.

1. **Bars 110 px wide at four columns.** A flex row divides its width; nobody
   asked what four columns of a twenty-eight-column chart look like. Capped at
   26 px and centred.
2. **The rate drawn as bars from nought was four identical blocks.** A sum is a
   bar and a rate is a line, and this is a correctness rule rather than a taste
   — bars from zero hid the only thing the reader came for.
3. **The line rendered as a 16 px squiggle in the corner.** `.ws-win svg` sets
   every SVG in the window to the icon size, and being an unlayered presentation
   hint it beats the stylesheet. **The calendar's pinned weekday column documents
   this exact trap and solves it the same way** — an inline `style`. It was
   walked into anyway, one file over.
4. **A flat rate drawn as a mountain range.** Fourteen weeks at an identical rate
   folded to `156.00000000000003` against `155.99999999999997`; a line that pads
   a range of `1e-14` turns the last bit of a double into three distinct levels.
   A range under half a percent of the reading is now no range at all.
5. **`10 Aug17 Aug` as one run of characters.** The final tick was always drawn,
   and at fourteen columns it lands one column after the stepped one before it.
   A colliding label is worse than a missing one — the neighbour was legible
   until it arrived.

**And one that was not a defect but a bad default**: the view opened on the
coarsest grain offered, which put ninety days of record onto four monthly
columns. It opens on weeks now, or the finest grain there is.

### The ADR number was taken while the session was running

This track wrote twelve citations to **ADR 0234** into source and tests before
the file was written; the insert-delivery track landed *its* 0234 in the
meantime, and every one of them had to be renumbered to 0235. The tree's own
rule already says grep before you number, and the grep was done — at the start.
**Grep again immediately before writing the file**, or cite nothing until it
exists.

## The record — Stage E, 2026-08-18

Sixth session, same day as Stage D. The owner read the four new views against
**447 real dictations** and reported four things; a fifth followed from what the
fourth produced. Durable form is
[ADR 0236](../decisions/0236-a-turnaround-is-read-by-band-and-by-cause-the-language-is-stored-on-the-record-and-a-control-that-will-not-act-is-not-shown.md).

**Suite: 935 → 942 frontend cases over 56 files, and 992 Rust cases** (the last
measured Rust figure was Stage C's 917; E3 is the first Rust in this track since
B3). `npx tsc --noEmit` and `npm run build` clean. A dev host **was** running —
PID 3413540 — so every `src-tauri/` edit was batched into one pass and the app
restarted once rather than five times. The runtime log went 8259 → 9450 lines
over the session; no capture measurement was in flight.

### The number under `Too short to name` was right and the sentence was ours

This is the finding worth carrying out of the session. The owner asked how 91
runs could be unnamed when both a deterministic detector and a model naming call
are in the tree. Both are, and both work — the runtime log for the same period
holds **75 naming lines of which 74 returned a language** (67 `de`, 6 `en`, 1
`nl`). The ledger says 447 dictations, 356 named, 91 unnamed, and the ratio
matches the log's own gap almost exactly.

**Nothing stored the answer.** `contributed_language` ran inside the ledger write
and was discarded with it, so `seed_from_history` — the rebuild that runs
whenever the ledger file is missing or has been reset — had nothing to read and
re-measured with the offline detector alone. Its floor is eight words or twenty
characters; **54 of the 389 records still on disk are under it against 17 under
the naming floor**. So the label was describing the smaller of the two causes
and hiding the larger one, which was a defect in this tree rather than a
property of short dictations.

The fix is one additive field and it repairs nothing retroactively. That is
worth saying plainly to whoever reads the tile next year: those 91 stay unnamed
forever.

### The chart was legible and asked nothing, which the suite cannot see

346 timed runs, 25 ms buckets, a span of 379 buckets — drawn as 24 columns of
400 ms with **11 of them empty**, held open across their whole width by a single
9.975 s run. Every hint read *N dictations came back between 4.5 and 4.9
seconds*, and the column beside it said the same with a nought. Nothing is wrong
in that picture; there is simply no question it answers. **A band carries a
share, and a share is what a wait is read for.**

The same reading is why the cause list exists at all: the owner's own framing
was *das ist ja der Sinn vom Turnaround* — finding out what causes it. The
ledger cannot answer that (its histogram is counts per 25 ms and carries no
model), so the list reads the records, and it is now **the only reading on Home
that is not all-time**. It says so, because history is pruned and the ledger is
not.

### One recogniser, two vendors, an eightfold difference — and no word saying so

The list's first build printed `whisper-large-v3-turbo openai` and the owner
asked whether that was the model's author, the profile, or the vendor. It is the
vendor, and on this machine the ambiguity hides the whole point: the same
recogniser reads **1.0 s over 261 runs through one vendor and 5.8 s over one run
through another**. One word — `via` — plus the catalogue's written name, and an
unknown id printing raw rather than throwing, because these ids come off records
an older build may have written differently.

**Grouping by profile was considered and dropped.** One delivery mode is in use
per profile here, so a profile split would have compared delivery modes while
claiming to compare profiles. `effective_mode` is on every record, so a mode
split is available whenever it is wanted.

### The decimal point was a glyph fact, not a scaling one

`3.5` merged and `1.0` did not, on one component and one code path. Seven of the
ten glyphs — `0`, `2`, `3`, `5`, `6`, `8`, `9` — light their last column in the
two rows the mark occupies; `1`, `4` and `7` do not. ADR 0191's reasoning was
about printed type, which has side bearings these do not. A gap the glyphs
cannot reach into on **either** side is the only arrangement that does not depend
on which digits happen to be showing.

### Disabling a control is not removing it

The dots were disabled under an open metric and the owner reported them again:
**mechanically switched off, visually still there.** A lit dot with an
unlit twin reads as a choice however inert it is. They are hidden now, with their
space held — the row is the last thing on the block, so unmounting it would lift
the chart being read.

### The browser page found all of it again, and this time it was the product

Stage D rendered synthetic ledgers in a throwaway Vite page. This session
rendered the **real** workspace over the dev server with `__TAURI_INTERNALS__`
stubbed and this machine's own `config.json`, `activity.json` and `history.json`
behind it, then clicked the tile and read the DOM back. That is how the vendor
labels, the parked dots and the five band names were confirmed rather than
assumed. The harness is fifty lines and it is the third session in a row where
looking at the page was the only thing that could have found the defect.

## The record — Stage F, 2026-08-19

Same session as Stage E, continued past midnight. Durable form is
[ADR 0237](../decisions/0237-the-transcripts-are-their-own-collection-so-the-index-retention-stops-taking-them-and-the-archive-gets-a-reading-and-a-door.md).

**Suite: 942 → 945 frontend cases over 56 files, and 992 → 997 Rust cases.** Two
of each are this stage's; the other track in the tree landed the rest while the
session ran — three Rust cases in `trigger.rs` and one frontend case in
`Hotkeys.test.tsx`, both verified against `HEAD` rather than assumed from the
totals. `npm run build` clean. `npx tsc --noEmit` reports one error in
`src/test/shortcutRuntime.ts`, which is that track's in-flight edit and not this
one's — every file this stage touched is clean.

### A question about one list turned out to be about the files

E2's cause list reads `history.json`, not the ledger, and the owner asked how
far back that reaches. The arithmetic is the finding: **417 entries in 51 hours
is about 196 dictations a day**, and `HISTORY_CEILING` is 1000, so the index
holds roughly **five days**. The account's `history_retention_days` stood at 7 —
a leftover ADR 0185 recorded and did not change — but at this rate the ceiling
binds long before the age does, so the seven days were never the operative rule.

Then the second half of the question, which is the one that mattered: *what
happens to the Markdown files?* They went with the entry. A cap chosen so a list
stays fast was deleting the reader's writing after five days, and nothing on any
screen said so — the only place the coupling appeared at all was a retention
hint reading *older dictations are deleted with their transcript files*.

### Four repairs were offered and the biggest one was chosen

Raise the ceiling, fix the local retention value, bound the index by bytes, or
decouple the files. The answer was the fourth, in the owner's words *Markdowns
vom Index entkoppeln*. This is the same shape as the 2026-08-17 reading in the
traps below: offered a range of fixes, the owner takes the structural one.

**What that does not do was said before it was built, and it still stands.** The
cause list reaches five days either way — the index is what it reads, and the
ceiling is unchanged. Decoupling saves the transcripts, not the reach.

### Two collections, two rules, and one of them needed a door it never had before

The decoupling creates a file nothing can reach: once the entry is pruned no
code holds the path, so History has no row, no Reveal and no Retry for it. That
is the whole reason `purge_transcript_archive` exists and the reason it is
allowed to walk a directory that ADR 0074 explicitly forbade walking. The
permission is the shape check — a four-digit year, a two-digit month,
`<DD-HHMM>-<slug>.md` — and it was tested against the reader's plausible
contents rather than against the store's: a note, a `.txt`, a file loose at the
root, a nested folder that is not a year. **All 406 files in the real archive
match the shape**, which is what makes the check safe to rely on.

The card is the `Audio from a failed dictation` card's shape reused, and it had
to be: three collections had already answered `Kept for` in the same words, so a
fourth that phrased it differently would have read as a different kind of rule.
Rendering it over the dev server against the real numbers gave
`406 files · 281 KB` with no overflow at 625 CSS px.

### One test had to be inverted, and that is the record of the reversal

`retention_takes_the_pruned_records_files_with_them` asserted exactly what this
stage stopped doing. It is now
`retention_drops_the_entry_and_leaves_its_file_alone`, and it asserts both
halves — the file survives AND the entry is gone — because the first alone would
pass if the prune had simply stopped running.

## The record — Stage G, 2026-08-19

Same session again, continued out of Stage F's closing paragraph. Durable form
is
[ADR 0240](../decisions/0240-the-index-is-read-when-it-changes-carries-what-a-row-needs-and-the-turnaround-causes-move-into-the-ledger.md).

**Suite: 945 → 949 frontend cases over 57 files, and 997 → 1006 Rust cases.**
The nine Rust cases are five in `activity_ledger.rs` and four in `history.rs`;
the four frontend cases are one new file, `useTranscriptionHistory.test.tsx`.
`npm run build` clean, `npx tsc --noEmit` clean, `cargo test` 1006 passed, 0
failed, 6 ignored.

### The owner rejected the repair Stage F left open, and asked for the cause instead

Stage F closed saying the cause list still reaches five days because the ceiling
is unchanged. The owner's answer was not *raise it* — it was **at a thousand
records this stops making sense, so optimise it**, and then, twice, a wider
instruction: *every metric on Home gets only what it really needs, and generally
every function in the app gets only what it really needs, so we do not drag
unnecessary ballast around and end up with ceilings like a thousand files.*

That reframes the ceiling as a symptom. The index is expensive per record; the
ceiling is where that expense was capped; raising the cap alone buys reach and
pays for it on every dictation.

### The premise was half wrong, and the correction is the reason to read this

The question as asked was *why is `history.json` fully parsed and fully written
back on every dictation?* **The parse half is wrong.** `ensure_loaded` returns
early on a `loaded` flag; `load_history_entries` runs once per process, on first
access. The write half is exactly right: `save_history_entries` serialises the
whole `VecDeque` and replaces the file on every record.

Correcting it mattered because the wrong half would have sent the work at a
read-side cache that already exists, and the right half is where the O(records)
cost actually lives.

### What was measured, and none of it is estimated

The reporting machine's index at the time: **478 records, 1,172,580 bytes
minified, 2,453 bytes a row.** Pretty-printing was **229,019 of those bytes,
16.3%** — the first estimate written down for that was 8% and about 100 kB, and
it was wrong by a factor of two.

Three findings, ranked as they were reported:

1. **The write is whole-file, non-atomic and pretty-printed.** A crash between
   truncate and the last byte leaves a half-written index where a whole one was.
2. **The worse one: `useTranscriptionHistory` polled every five seconds.** Not
   the write — the READ. Twelve reads a minute of the entire index, whether or
   not anything had happened, whether or not the workspace was even the visible
   window. At 1,172,580 bytes that is **14.1 MB a minute** over the IPC bridge,
   for a file that changes about 196 times a day.
3. **The rows carry fifteen fields no screen reads.** 591 bytes a row, 24.1% of
   the payload, `input_level` alone 161. Each was checked against every reader
   in `src/` rather than against a guess: the near misses are real and they are
   all on other shapes — `input_level` on a native event payload,
   `active_driver` on `platform`, the `local_prompt_*` pair on `config`,
   `speech_seconds` on `LedgerDay`.

### The delivered payload, before and after

| | Before | After |
|---|---|---|
| Bytes a row | 2,453 | 1,113 |
| 478 records | 1,172,580 B | 532,436 B |
| Read frequency | every 5 s, 12/min | on a record-writing event, and on `visibilitychange` |
| Cost per minute, idle workspace | 14.1 MB | 0 |

**54.6%**, and the frequency term is the larger of the two changes.

### The cause list moved into the ledger, and the seed lands two runs short

`turnaround_causes` is a `provider/model` key to its own 400-bucket histogram on
the 25 ms axis the bands already use, bounded at 64 keys because the key comes
off the wire. Live writes go through one `if let Some(milliseconds)` with both
`add_turnaround` and `add_turnaround_cause` inside it, so no run can land in one
term and not the other.

**The seed is short and the code says why.** On the real file it filled three
rows totalling **420 runs** against an all-time histogram of **422** — the seed
skips records with `words == 0 && spoken_words == 0`, and the live funnel counts
their turnaround. The first comment written for this asserted the two always
agree; the ledger on disk refuted it within the hour. Two runs in 422 is the
honest shape of a term seeded after the fact, and ADR 0179's field-wise maximum
means it can only ever be raised from there.

Rows on the reporting machine after the seed: `groq/whisper-large-v3` 94,
`groq/whisper-large-v3-turbo` 325, `openai/whisper-large-v3-turbo` 1.

### The ceiling moved, on a measurement rather than on a feeling

A throwaway `src-tauri/tests/index_write_cost.rs` timed serialise and
write+rename over 20 runs at five sizes, in debug and in release, and was
deleted afterwards. Release:

| Records | Bytes | Serialise | Write + rename | Total |
|---|---|---|---|---|
| 478 | 1,160 kB | 2.4 ms | 0.2 ms | 2.6 ms |
| 1,000 | 2,423 kB | 4.3 ms | 0.4 ms | 4.8 ms |
| 2,000 | 4,837 kB | 8.4 ms | 0.8 ms | 9.2 ms |
| 5,000 | 12,099 kB | 22.7 ms | 2.2 ms | 24.9 ms |
| 10,000 | 24,277 kB | 55.1 ms | 4.3 ms | 59.4 ms |

Against a median turnaround of 1,210 ms, 24.9 ms is 2% of a dictation and 59.4
is 5%. **5,000 was chosen because 10,000 is where the number starts being felt**
— and because past it the honest fix is an append-only journal, which is a
change to how the file works rather than to a constant in it. The debug figures
are 15 to 20 times worse (442 ms at 5,000), which is what a dev host feels and
is not what ships.

### One number the next session inherits, and it was read wrong

**Stage G recorded the owner's `history_retention_days` as 7 and concluded that
retention, not the ceiling, was the binding rule. Both halves are wrong.** The
G6 review read the live file: `~/.config/WordScript/config.json` holds
`history_retention_days: 365` and `history_limit: 5000`. The 7 was never
verified against the config; where it came from is not recoverable.

The conclusion inverts with the number. At 365 days and 217 dictations a day the
ceiling is reached in **23 days** and retention in **365** — so the ceiling binds
by a factor of sixteen, and the setting the reader chose on Privacy & Data is the
one that never applies. That is the finding Stage H exists to fix, and it is why
the fix is a unit change rather than a bigger number.

`history_limit` is not a second setting to weigh against it: `config.rs` pins it
to `HISTORY_CEILING` on every load (ADR 0185), so a stored value is a leftover.

**Forward pointer, because this section is written to be acted on:** everything
above about 5,000 is the record of what Stage G decided and measured, and it
stands as that. It is no longer the durable answer — see **Stage H** and
[ADR 0241](../decisions/0241-a-bound-on-stored-dictations-is-a-bound-in-bytes-so-the-index-becomes-a-journal-and-both-collections-get-a-warning-and-a-ceiling.md),
which delete the count ceiling rather than move it.

## The record — Stage H, 2026-08-19

**A different session from Stage G, and the only one on this page that inherited
its stage rather than opening it.** Stage H was already written as a brief and
[ADR 0241](../decisions/0241-a-bound-on-stored-dictations-is-a-bound-in-bytes-so-the-index-becomes-a-journal-and-both-collections-get-a-warning-and-a-ceiling.md)
was already in the tree as *Accepted, and not built* — uncommitted, beside the
finished G6 code. The mechanism is
[ADR 0242](../decisions/0242-the-journal-replays-into-a-list-the-archive-counts-itself-by-day-stamps-and-the-byte-that-is-bounded-is-the-content-byte.md).

**Suite: 953 → 955 frontend cases over 57 files, and 1006 → 1022 Rust cases.**
The sixteen Rust cases are ten in `history.rs` and six in `transcript_store.rs`;
a seventeenth is `#[ignore]`d and runs on demand, which is why the ignored count
went 6 → 7. The frontend delta is four new cases in `Privacy.test.tsx` against
two removed, so no new file and the count of files does not move. `npm run
build` clean, `npx tsc --noEmit` clean, `cargo test` 1022 passed, 0 failed, 7
ignored.

**Read the start number, not the last record's close number.** Stage G's record
closes at 949 frontend cases and this session started at 953: four cases arrived
from other tracks in between, and counting them as Stage H's would have been the
same mistake Stage F caught itself making.

### The first job was to believe the tree, and it took a suite run to do it

An inherited stage arrives as claims. The tree held two coherent blocks — the
finished G6 code, and Stage H's brief with its ADR — and the previous session's
numbers were quoted rather than reproducible. **Both suites were run before
anything was touched**, which is what turned *the tree is clean* from an
assumption into a measurement, and is what made the 953 above a real baseline.

### The build order is a finding, not a preference

**H1, H2, H4, H3, H5.** H4 moved ahead of H3 because ADR 0241 measures its own
10 GB ceiling at roughly 15 million files and about 1.2 million per month
directory. A byte ceiling laid over a layout that cannot hold those bytes is a
number the product states on a screen and cannot honour, so the sharding is a
precondition rather than a follow-up — the brief says so in its own row, and it
is the kind of row that is easy to read as an optimisation and defer.

### The tests that had to change, and the one that had to be inverted

**A retention test used the deleted count cap to make something drop.** Pushing
a record out with `history_limit` was the easy way to make the prune visible and
was also the wrong rule to be testing: what sweeps this index is age. It cannot
be written the obvious way either — `record_entry` stamps `now`, so nothing that
goes through the funnel is ever old enough to be pruned. **The record is aged in
the journal**, which is now the only way to have one older than the process that
wrote it.

**Two `#[ignore]`d harnesses read the developer's live store as an array.**
`capture_integrity_measurement` and `transform_context_measurement` both print
their record count as a finding, and after H1 both would have answered **zero**
and somebody would have written that zero down. They go through the replay now,
with the array as a fallback for a machine that has not yet run a build with the
journal in it. A measurement harness that silently reads the wrong file is worse
than one that fails.

**One test exists only to prove the cache is used.** Every other test in the
archive suite passes just as well if the tally is written and then ignored,
because a full recount gives the same answer. That one plants a tally which
disagrees with the tree under a stamp that matches it, and asserts the wrong
number comes back — which nothing but a cache hit can produce.

### Vitest was green while `tsc` was not, twice

`history_limit` survived H2 in a `createAppConfig({...})` literal inside
`Privacy.test.tsx`, and `tone="warn"` is not in the `StatusTone` union. Both are
type errors in a test file, both were invisible to a passing `npx vitest run`,
and both were found only by `npx tsc --noEmit`. **The frontend test run does not
typecheck**, so on this track the typecheck is not a formality after the suite —
it is the only reader of a test file's types.

### The migration has no test, and it was watched on the real store twice

There is one path no synthetic case covers: the reader's own `history.json`,
read once, converted, deleted. At the close of the stage the live store held
`history.jsonl` at **1,242,954 bytes, 511 lines, 511 puts, 0 unparseable, 511
live records after replay**, no `history.json` left, and an archive tally of
477 + 4 = **481** against exactly 481 `.md` files on disk.

**Read again nine hours later, after the owner had gone on dictating into it:**
515 lines, 515 puts, still not one tombstone, and 1,250,320 bytes — four
dictations cost four appended lines and 7,366 bytes, and nothing rewrote the
file.

**And the shard cache was caught mid-lag, which is the best evidence it could
have given.** `2026/08` carried a directory stamp identical to its tally, so its
477 came from the cache without a single stat. `2026/08/19` did not:
`1787137312448886267` on the directory against `1787137150570474992` recorded,
tally saying seven files where the directory holds eight. 477 + 8 = **485**, and
485 is every `.md` in the store. **A stale shard that says it is stale is the
whole design** — the next read recounts that one directory and no other, and no
reading in between was ever wrong, because the number was never taken from a
tally whose stamp had moved.

### Stage G's count of dropped fields was corrected, and one copy had been missed

Stage G recorded *fifteen fields no screen reads*. Counted off the structs: the
entry carries **40** fields and `TranscriptionHistorySummary` **25**, so 19 are
not carried across — and three of those nineteen are carried in cut form rather
than dropped, `raw_transcript` and `transformed_transcript` as 160-character
previews and `work_mode` as `processing_mode`. That leaves **sixteen left off
entirely.**

`ARCHITECTURE.md` and `SPEC.md` were corrected when Stage H opened;
`IMPLEMENTATION.md`'s row still said fifteen and is corrected with this record.
**The Stage G section above keeps its own number**, because it is the record of
what that session measured — the same reason the 7-versus-365 finding sits there
rather than being edited away.

### The trap this page documents, walked into with the shell's own state

`cd src-tauri && cargo test` leaves a persistent shell inside `src-tauri`. A
later `touch src/lib.rs`, meant for the frontend, was therefore
`src-tauri/src/lib.rs`, and **the running dev host rebuilt and restarted.** No
file content changed and git never saw it. Rule 3 under *Rules that still have
teeth here* says to batch anything under `src-tauri/` and to say out loud that a
rebuild is coming; what it did not say is that the path you type is not the path
you touch once a command has moved the shell. Absolute paths, or a `cd` back.

## The record — Stage I, 2026-08-19

**Opened by the owner the evening Stage H closed, with a procedure and then a
constraint.** The procedure came first: read the Stage H record and the traps
before anything else, **verify every claim on this page against the file before
believing it**, sort the raised items into *defect / decision / not repairable /
conditional*, and put that in front of him before building anything. The
constraint arrived once the sorting was accepted, and it is why this stage is a
schema change rather than seven repairs: **every metric on Home must be able to
exist indefinitely** — no half measures, complete and sustainable.

**And one point that reaches further than this track: the ADRs are not
fixed.** They are written as *Accepted* and they say so, and they can still be
overruled the moment something better exists. Stage I overrules the day-row
bound of [ADR 0176](../decisions/0176-a-lifetime-figure-that-can-fall-is-not-a-lifetime-figure-so-a-pruned-day-is-retired-and-only-a-button-clears-it.md), which was right for the question 0176 was
asked and wrong for the one asked here. A later session reading an *Accepted*
status as a closed door has the wrong model of this repository.

Durable form is [ADR 0243](../decisions/0243-a-reading-that-lasts-forever-is-a-mergeable-accumulator-per-period-so-the-ledger-grows-a-month-tier-and-every-field-says-when-it-started.md). Read it before touching the ledger; this
section is what happened, not what was decided.

### Four of this page's own claims were wrong, and being told to check is why they were found

**The instruction to check every claim against the file was not a formality.**
Four of the eight raised items misdescribed the tree they pointed at, and two of
the four changed what got built:

- **Item 6 — *`Not named` will hold 91 runs forever*.** It was 104 the next day.
  The counter is TWO populations sharing one number: a frozen backlog — **411 of
  519 index records carry no `spoken_language` at all** — and a live residue
  that grows with every brief dictation, **13 of 99 on 2026-08-19**, the first
  full day the field existed for. *Forever* was true of the first half and false
  of the second. The entry's own conditional — *if the tile ever needs to
  distinguish refused from lost* — turned out to be the whole repair, filed
  under *someday*.
- **Item 5 — *a per-mode cut is the free version of this*.** It is not free.
  `LedgerCause` carries a provider and a model and has no mode dimension at all;
  giving it one is the same schema change as everything else in this stage,
  which is why it is inside ADR 0243 rather than ahead of it as a cheap first
  offer.
- **Item 8 — *now a year apart instead of three weeks*.** Understated in the
  other direction. Retention pruning runs on every read and `RETENTIONS` offers
  seven days, so on a short retention the reload key goes stationary within a
  week rather than within a year. The item was deleted rather than repaired.
- **Item 1 — *the one that has been open longest*.** A framing rather than a
  defect: ADR 0177 answered the measurement two stages ago. What was actually
  left is that the tile never said over how many runs it was measured, and
  `timed` against `voiced` was already on every row.

### Two defects nobody had raised, found by measuring the file rather than reading about it

**`activity.json` was written whole, pretty-printed and non-atomically, on every
dictation.** `to_string_pretty` followed by `std::fs::write` — truncate in
place, no temporary, no rename. **21,326 bytes on disk against 5,634 bytes of
content: 73% of the file was indentation**, and `recorded_seconds` was stored as
`4647.276553287982`, twelve digits of which three are a measurement.

This is the defect Stage G found on `history.json` and Stage H fixed for the
index and not for the ledger. It is worse here: [ADR 0179](../decisions/0179-the-ledger-is-the-only-thing-in-an-archive-that-cannot-be-rebuilt-so-a-restore-raises-it-and-never-replaces-it.md) says in
its own title that this is the one file in an archive that cannot be rebuilt
from anything else. A crash between the truncate and the last byte destroyed it
outright, and there is no second copy to replay from. Stage H's closing block
says *this stage does not touch the ledger, and it must not* — correct for Stage
H, and exactly why the ledger kept a defect the index had already lost.

**`MAX_CAUSE_KEYS` dropped runs silently.** `add_turnaround_cause` returned
without counting when the map held 64 keys and the key was new. The rows then
stopped summing to `turnaround_buckets`, and the display's own note that they do
became false with nothing anywhere to say so. Sixty-four is generous for a week
and small for a decade: the model catalogue turns over, and every retired model
holds its slot forever while the current one is refused.

### The sorting, and where each item went

| Raised | Sorted as | Landed as |
|---|---|---|
| 1 · the rate states no coverage | defect, cosmetic | `Measured over: n of m` in the tile's facts |
| 2 · a third marker needs a list | conditional | `MARKER_SOURCES` is a table; the legend counts the kinds present |
| 3 · the undo window is one row deep | **decision** | decided in ADR 0243 §8; nothing built |
| 4 · turnaround and languages have no history | defect of shape | both are per-day accumulators now |
| 5 · a per-mode turnaround cut | defect (the *free* claim) | `mode_causes`, a second one-dimensional cut |
| 6 · `Not named` holds 91 forever | defect | split into *too short to name* and *never asked* |
| 8 · the ledger reloads on a key that can stall | defect | the key is deleted; the hook listens to the event |
| 9 · Home fetches every summary to draw five rows | defect | a limit, plus an `owed_fallback_only` filter in the runtime |
| the three per-record numbers | **not repairable by building** | re-measured; below |

Seven of the nine are one missing rule applied seven times. That is the whole of
ADR 0243's argument and the reason this stage is one record rather than seven.

### The three numbers Stage H could not re-measure, re-measured

Stage H closed with an explicit open item: three figures from one 2.3-day window
on one machine, *enough to reject a count ceiling and not enough to have sized
the budget*. Measured again on 2026-08-19 over four calendar days, 522 live
index records and 492 transcript files:

| Number | Stage H | Stage I | Moved |
|---|---|---|---|
| bytes per transcript, mean | 684 | **685** | no |
| bytes per transcript, median | 392 | **386** | no |
| bytes per index record | 2,432 | **2,550** mean, 2,260 median | +5% |
| dictations a day | 217 | **187** — 194 and 180 on the two whole days | −14% |

**The archive figures held to within a byte**, which is the first evidence that
they are a property of how this reader dictates rather than of one window. The
index record grew 5%, which is `spoken_language` and the fields ADR 0236 added.
The rate fell 14%, and 217 was always a two-and-a-bit-day average over a window
that included a working evening.

**What the numbers say about the budget, which is more than Stage H could say.**
At 187 dictations a day the index grows 477 kB a day — but the index has a
retention, so it has a steady state rather than a trajectory: **43 MB at the
90-day default, 174 MB at this machine's 365, and 1.6 GB at the 3,650-day
maximum the product offers.** Under the 5 GB warning at every setting that
exists. The archive has no retention at all (ADR 0237) and grows at 128 kB a
day: **5 GB is about 115 years away.** So the two thresholds are no longer just
round numbers chosen to be safe — for the only collection that grows without
bound, the warning is a century out at this rate and about eleven years out at
ten times it, which is the first rate at which either number does any work.

This does not make them measured, and the honest status is unchanged: one
machine, one reader, one week. What changed is that the claim *far above any
plausible use* now has a number attached to it.

### What was rejected, each for a reason worth keeping

- **A `months` tier that also holds the live days.** It would let the *Months*
  tab answer for today. It also means two tiers that must be written in the same
  breath forever, and a write path that updates one and forgets the other
  diverges **silently** — every figure still a plausible number, nothing able to
  say which. The disjoint ladder fails loudly instead. This is the single
  decision the whole tier design turns on.
- **Storing `language_unasked`.** It is a remainder, and `raise_to` merges field
  by field, so a stored remainder can survive a merge that moved the two numbers
  it is the remainder of. Derived, a row cannot disagree with itself.
- **Storing fixed five-band turnaround per period.** The display chooses band
  edges per lane from three sets at read time; storing bands would freeze a
  choice that is not the ledger's to make.
- **Storing the fine 400-bucket histogram per month.** ~9.6 kB a year, 480 kB
  over fifty. The quarter-octave log histogram is 41 buckets and answers every
  band-set, at an interpolation error bounded by one bucket width.
- **Journaling the ledger the way Stage H journalled the index.** The argument
  does not reach: the index is an unbounded log with a replay, the ledger is a
  bounded accumulator with no second copy. Different shapes, different answers,
  and ADR 0243 §6 says so in the record so a later session does not read the
  ledger as an oversight.
- **Keeping every day row forever.** 4.9 MB over fifty years, parsed on every
  read, to answer a question twelve month rows answer for 4 kB.
- **Dropping the earliest month row rather than adding `prehistory_through`.**
  Approximate where a field is exact. The stamp costs eleven bytes once.

### The migration was watched on the real store, because nothing tests it

Stage H's record says the same thing about `history.json`, and it is the same
gap: the reader's own `activity.json` is converted by a path the suite never
runs. Backed up first — the file [ADR 0179](../decisions/0179-the-ledger-is-the-only-thing-in-an-archive-that-cannot-be-rebuilt-so-a-restore-raises-it-and-never-replaces-it.md) names as unrebuildable —
then the host was restarted and the result read off disk:

| | Before | After |
|---|---|---|
| schema | 2 | **3** |
| bytes | 21,326 | **8,421** |
| stray `.tmp` sibling | — | **none** |
| lifetime dictations | 580 | **580** |
| day rows | 4 | 4 |
| `months` | — | **empty** |
| `prehistory_through` | — | **absent** |

**`months` empty and `prehistory_through` absent are both correct**, and a
session that expects otherwise will "fix" a working migration. The tiers are
disjoint, so a day appears in `months` only when it leaves `days`, and no day
here is near the horizon; `retired` has never held anything on this machine, so
there is no prehistory for a stamp to describe. The seed backfilled what the
index could still speak for: **468 timed runs** into the per-day accumulators
and their log buckets, the language split, and `mode_causes` at **465 `cleanup`
against 3 `agent`** — the first cut of the turnaround by mode that has ever
existed. `measured_from` stamps both new fields at 2026-08-16, the earliest day
the index still reaches.

**One thing worth naming: a migration alone does not land.** It runs on read and
persists on the next write. Here the seed was the write and the file changed
within a second of the host coming up, but a schema change that needs no seed
would sit in memory until the next dictation, and a session checking the file
too early will read a schema 2 ledger and conclude the migration failed.

### Rounding on accumulate is not rounding the total, and the test that got it wrong was mine

`recorded_seconds` is rounded to milliseconds **as each run is added**, so a
period holding two 0.3333 s runs stores 0.666 and not 0.667. The first version
of `seconds_are_stored_to_the_millisecond_and_no_further` asserted the second
number, and the code was right. The alternative — keeping full precision and
rounding at read — would put the float artefact back in the file, which is the
thing being removed. The case now states the behaviour rather than testing a
number, because the difference is real, bounded at half a millisecond per run,
and will look like a defect to whoever finds it next.

### Two Rust cases and one Vitest case asserted the old behaviour, and all three were rewritten

`a_day_that_ages_out_is_retired_into_the_totals_rather_than_dropped` asserted
`retired.dictations == 1` after a prune; the day now goes to its month, so it is
`a_day_that_ages_out_is_folded_into_its_month_rather_than_into_one_total`.
`the_cause_map_stops_at_its_bound_and_keeps_counting_what_it_knows` asserted a
map length of 64 and a dropped run; it is now
`the_cause_map_stops_naming_at_its_bound_and_never_stops_counting`. On the
frontend, the case that asserted *turnaround is a spread rather than a history*
was asserting an absence this stage removed. **None of the three was deleted** —
losing a case at the end of a step is the signal that the step is wrong, and
each of them still tests the rule it was written for, against the new answer.

**Counts, measured at this session's own start rather than taken from the page:**
Rust **1022 → 1028**, frontend **955 → 960 over 57 files**, `npx tsc --noEmit`
clean, `npm run build` clean but for the pre-existing chunk-size warning. The
first run of each reported failures, which is where the two Rust cases and the
frontend case above came from; the baselines quoted are reconstructed from that
run and not from the numbers this page carried.

## The record — Stage J, 2026-08-19

**Opened within the hour Stage I closed, by the owner reading the screen Stage I
had just shipped.** Two reports, and both were right about something neither of
us had written down:

1. **`Never asked` only makes sense for the one developer with accumulated local
   data.** Nobody else has any.
2. **It is not clear whether the two turnaround lists add up or are already
   split** — whether *which model heard it* and *what the mode cost* are
   components of one total or two views of it.

Durable form is [ADR 0244](../decisions/0244-there-is-no-legacy-in-a-developer-build-so-the-retired-tier-the-prehistory-stamp-the-schema-migrations-and-the-duplicate-language-counter-are-deleted.md). This section is what the checking found.

### `Never asked` did not measure what its own ADR said it measured

ADR 0243 called it *the runs from before the record kept an answer*, and the
label on the screen said the same. **It is the reach of the SEED.** The lifetime
`languages` map had counted live since ADR 0180; the per-day split was seeded, on
the day ADR 0243 shipped, from the records the index still held. Sixty runs sat
in the first and not the second, because the index had lost their records to
edits and retention in between. On the live path every counted dictation
increments exactly one of the two halves — so on any installation from here on
the figure is structurally zero, forever.

The entry's own author had measured its population three times and never
measured what produced it.

### And the same split had put an arithmetic on the screen that does not add up

| Row | Read from | Value |
|---|---|---|
| `Named 479 of 586` | the lifetime map | 479 |
| `Too short to name` | the tiers | 114 |
| `Never asked` | the tiers | 60 |

**653 against 586 dictations.** Two generations of one counter, drifted by 67
runs, presented as one list — the plausible wrong number this track exists
against, produced by the record written to prevent it. Nothing in the suite could
see it: every case fixture set one counter or the other, never both.

### The turnaround question was a real ambiguity and hid a real defect

Three totals stacked, identically shaped: `Runs timed 474`, then `474 runs all
time`, then `474 runs all time`. The sentence explaining that the second list is
the same runs cut another way sat **below both lists**, where it arrives after
the reader has already answered the question wrongly.

Underneath it, a defect: `add_mode_cause` returns without counting when a record
names no `effective_mode`, so the mode cut can be short of the model cut. The
source comment there says *the rows then sum to less than the total, which the
surface states rather than papers over*. **The surface did not state it.** A
comment asserting a behaviour is not that behaviour, and this one was written in
the same session that shipped the screen.

### The owner's answer was wider than the two defects

Not *repair what the screen read*, but **delete the accumulated local store, and
build no migrations and no second system that holds on to local legacy data in a
developer build.** The machine the data sits on is not a working environment
whose contents have to survive.

**There has never been a release build, so there is no installed base, so there
is no legacy.** Both defects above were the same construct wearing two hats: a
compatibility path kept for one machine, whose output nobody could see was wrong
because nobody else could produce it.

### What was cut, and one of them was not asked for

`Never asked` and the duplicate counter were named. **`retired`,
`retired_through`, `prehistory_through` and the schema migrations were not** —
they were put to the owner as the same rule applied consistently, and approved
on the same terms as Stage I: no half measures, complete and sustainable.

`retired` existed because pruning destroyed a day's shape (ADR 0176). ADR 0243
removed that reason twenty-four hours earlier, and `prehistory_through` had been
written the same day to describe the blob's edge. **A field introduced to
describe a construct is deleted with that construct** rather than kept because it
is new.

What stayed, and the line it sits on: the histogram AXIS and WIDTH guards, which
drop counts taken on a scale this build does not use — a defence against a
constant being edited in the present, which fires on a developer rather than on
an upgrade. The seed from the index, which rebuilds a lost ledger from records
that still exist. `raise_to`, which merges a restored backup (ADR 0179). None of
those is compatibility with a build nobody ran.

### The suite caught a defect in the deletion, which is the argument for rewriting cases instead of deleting them

`ledgerSpeaksFrom` used to be *the day after `retired_through`, or the first day
row*. With the stamp gone the obvious rewrite is `return ledgerFirstDay(ledger)`,
and it is **wrong**: `ledgerFirstDay` prefers `started_on`, which is where the
RECORD begins, not where the DAY TIER begins. On a record whose old days have
been folded into months, `started_on` sits a year before the oldest day row — so
a day series would have drawn a year of empty buckets over periods the day rows
cannot speak for, which is ADR 0172's one forbidden claim.

Two cases failed on it, both of them cases that had been *rewritten* from
asserting the retired tier rather than deleted with it. Deleting them would have
shipped the defect.

### The three cases that asserted removed behaviour, and what replaced each

| Was | Now |
|---|---|
| `a_throughput_histogram_from_the_old_schema_is_dropped_and_the_days_are_not` | `an_older_schema_is_stamped_and_never_converted` — the guard against a `schema < N` branch coming back without the question *whose file is that for* being asked |
| `a_run_nothing_asked_about_is_derived_and_never_stored` | `every_counted_dictation_lands_in_exactly_one_half_of_the_language_split` — the identity that made the third population removable, and that the screen's denominator now rests on |
| `starts a drawable series after the last retired day` | `starts a drawable day series at the oldest day row and no earlier` — the case that caught the defect above |

One case was added rather than rewritten:
`a_ledger_created_from_nothing_states_this_builds_schema`. A ledger born at
schema 0 and stamped on the next read is invisible on every screen, harmless
until the release that reads the stamp, and exactly the kind of fact that moves
without anybody noticing.

### Measured on the real store, after the deletion

The store was backed up and deleted — `activity.json`, `history.jsonl` and 492
transcript files — and the host restarted on nothing. The ledger the build wrote
from scratch:

```
{"schema":3,"started_on":null,"installed_on":"2026-08-17","months":{},
 "measured_from":{},"reset_at_ms":null,"days":{},"rate_buckets":[],
 "turnaround_buckets":[],"turnaround_bucket_ms":0.0,"rate_bucket_wpm":0.0,
 "turnaround_causes":{},"mode_causes":{}}
```

No `retired`, no `retired_through`, no `prehistory_through`, no lifetime
`languages` — and `schema: 3` on the first write rather than on the second.

**Counts, measured at this session's own start:** Rust **1028 → 1029**, frontend
**960 → 962** over 57 files, `npx tsc --noEmit` clean, `npm run build` clean but
for the pre-existing chunk-size warning.

## The record — Stage K, 2026-08-22

**Opened by the owner reading the turnaround detail Stage J had just corrected**
and reporting that it is still unreadable — not for a casual user, for the power
users this product is built for. Five questions came back off one screen: what
the first heading is asking; whether its seconds are the whole wait or a part of
it; how long the model took and for what exactly; what the second heading's
figure is and which interval it covers; and whether the first stage is inside
that figure or outside it. The explanatory note under the lists did not settle
any of them. Alongside the questions, three instructions: the screen carries far
too many small texts, a short paragraph is a last resort rather than a device,
and the subject of the screen has to be clear on sight. **All four metric
details were named, and the turnaround first.**

Durable form is [ADR 0247](../decisions/0247-a-wait-is-two-stages-so-the-runtime-measures-both-and-the-metric-detail-states-its-reading-before-it-draws-the-evidence.md). This section is what the checking found.

### The ambiguity was not in the copy, it was in the record

`turnaround_causes` and `mode_causes` were fed **the same `turnaround_ms`**. One
number, filed under two keys, drawn as two lists under two headings that each
implied a stage. There was no *first model in or out* to answer, because neither
list had ever held a stage: both held the whole wait.

On the reporting machine that produced two figures that agreed because they were
one measurement:

| List | Rows | Median |
|---|---|---|
| `Which model heard it` | one, over 138 runs | 0.9 s |
| `What the mode cost` | `Cleanup`, over 129 of the same 138 runs | 0.9 s |

A reader who noticed the agreement would conclude the rewriting is free. A
reader who did not would read the second figure as a component of the first.
Both readings are wrong and the screen supported both.

### Reading the split off the stored records was not possible

A history entry keeps `turnaround_ms` and nothing finer, so no arithmetic over
the store recovers where the wait went. **Either the runtime measures the split
or the screen cannot state it**, and the owner chose to measure. The cheaper
option on the table — leave the record alone and rename the headings so they
stop implying a stage — was rejected in the same answer.

### One stamp, taken before the staleness check

`heard_ms` is `export_ms` plus the elapsed pipeline time, read the instant
`transcribe_audio_file` returns and **before** the session is tested for
staleness, so an aborted dictation measures the same interval a delivered one
does. The rewriting is the remainder up to delivery, computed once in the ledger
funnel as `total - heard`. The recogniser-output repair between the two is
sub-millisecond string work and is deliberately counted with the mode rather
than given a third stage; the source says so where it happens.

**The pair travels as one value.** `TurnaroundFacts { total_ms, heard_ms }`
replaced the loose `Option<u64>` on six signatures rather than a second
`Option<u64>` being added beside the first — two adjacent optional durations in
a long signature are told apart only by position, and swapping them fails
silently. This is the argument `CaptureFacts` already carries in this tree,
applied a second time.

### Absent is not nought, and it is a column that is not drawn

A stage bucket is written only where a split was measured. `None` and `Some(0)`
must not collapse: the first is *never measured*, the second is Verbatim
genuinely adding nothing, and a screen that renders both as `0.0 s` has invented
a measurement. **Nothing on disk can fill the stage histograms**, so the split
opens at 0 of 138 on the reporting machine. Rather than a column of dashes, the
stage column is not drawn at all and one sentence says when it will appear — a
sentence that deletes itself as soon as the first dictation lands.

### A median is read off its own histogram

`median(total) - median(rewrite)` is not the hearing. The stage medians come
from `heard_buckets` and `mode_transform_causes` through the same
`bucketQuantile` the bands already use, which returns a bucket's LOWER edge and
therefore reports the upper of two values at `q = 0.5`. One test expectation
written for this stage asserted the lower one and was wrong; the case now
carries the rule beside it.

### What replaced the two lists

One table, one row per name, named columns: **runs**, **heard in** / **rewrote
in**, **in total** — with a toggle choosing which cut is on screen instead of
stacking both. Above it a lead line states the reading in one sentence with the
figure at the front, and the qualifiers that were paragraphs are a single
middle-dot line under it. Every `ws-metric-note` paragraph is gone, and every
chart carries a title, because the read-out line under a chart is replaced on
hover and so cannot also name the drawing's subject.

The same shape was applied to languages, time saved and words per minute in the
same pass, as asked.

### Counts, measured at this session's own end

Rust **1043 passed**, 7 ignored — two cases added, one for a measured split and
one for a wait that carried none. Frontend **969 passed over 58 files**, of
which `MetricDetail.test.tsx` grew 11 → 15. `npx tsc --noEmit` clean,
`npm run build` clean but for the pre-existing chunk-size warning.

**Not verified:** no dictation has run against the rebuilt binary, so the stage
histograms are still empty in the real ledger, and the new layout has not been
seen at the workspace's 625 CSS px. Both are the first things to check.

## The sequence

**Stage A — the surface, on what already reads.** Nothing here is blocked.

| Step | What | Done means |
|---|---|---|
| **A1 · done** | The digit counter component: composite frame from `digits`, four reserved positions, right-aligned. Gallery entry. | It renders 7 and 1,240 without the box changing width |
| **A2 · done** | The four tiles on Home, **and the empty state in the same step**. Keycaps out — `KeyCap`, `keyCaps()` and the cap style block are Home-only and went entirely. The shortcut moved into the hero's fact line as the small `Keycaps` (the one `Context.tsx` uses). | Words per minute and time saved read from history; apps and languages carry `PreviewTag`; **a profile with no dictations sees the instruction, not four zeroes** |
| **A3 · done** | The calendar, vendored and converted to circles on the matrix palette, 26 weeks, growing with the install. **The growth clock turned out to be the history file, not the install** — see the record. | A day's colour steps with that day's dictation count |
| **A4 · done** | The day tooltip. Dictations real; meetings and uploads present as preview lines. | Hovering a day names its composition |
| **A5 · done** | The switch, its indicator, and persistence. `AppConfig.home_activity_calendar`, additive, on `workspace_nav_rail`'s shape. | The choice survives a restart |

| **A6 · done** | **The correction pass** — the owner read the four formulas back and asked whether each one means what its label says. Three did not, one was never stored, and the ledger could fall. [ADR 0176](../decisions/0176-a-lifetime-figure-that-can-fall-is-not-a-lifetime-figure-so-a-pruned-day-is-retired-and-only-a-button-clears-it.md) through [ADR 0181](../decisions/0181-the-wait-starts-when-you-stop-speaking-not-when-the-file-is-already-written.md). | Words per minute divides spoken words by speech seconds; time saved divides one set of runs against a baseline the reader owns; turnaround starts at the capture stop and is actually written to the record; languages counts what came back; the ledger cannot fall, travels in the backup and has a reset |

| **A9 · done** | **The manual switch, and History's list** — [ADR 0184](../decisions/0184-a-list-is-paged-and-a-screen-offers-what-it-used-to-recite.md). Home's half by ownership; History's because the same reading drove both and no track claims that screen. | The dots are two buttons that select a view; the calendar states how many days of the drawn year have a record; History is paged at a size the reader sets, filters by month with all time as the default, and its recited foot is gone — the folder and the retention rule are controls on the toolbar instead |
| **A8 · done** | **The calendar gets a year, a scroll and a key** — [ADR 0183](../decisions/0183-the-calendar-is-a-year-you-scroll-through-and-a-period-it-can-speak-for.md). | The period is a year and only a year, opening at its newest end; the box is twenty-six whole columns and every scroll position is snapped to one, so no circle is ever cut; the weekday labels are pinned outside the scroller; the ramp has a legend; and the swap is a layer behind the view, so the controls can be pressed without swapping it |
| **A7 · done** | **The evening after** — the owner used the counters and reported three things: turnaround still measured nothing, and two readings were behind hovers. [ADR 0182](../decisions/0182-a-counters-basis-belongs-under-the-figure-and-the-preview-path-is-not-the-park.md). | The preview path carries the turnaround to its commit, so a clipboard-only machine fills the histogram at all; the baseline and the language share are under their figures and the hovers state only what the tile is; the baseline is three named speeds and a field, asked once in Onboarding |

| **A10 · done** | **The night after** — the owner used the finished block and reported that the tooltips did not work, that `Languages` said *only German* to somebody who dictates in two, that the fact line said the mode twice, and that the calendar's ramp was orange everywhere. [ADR 0186](../decisions/0186-a-tile-explains-itself-everywhere-and-only-german-was-a-claim-the-record-never-made.md) and [ADR 0187](../decisions/0187-a-ramp-whose-every-real-value-is-the-maximum-is-not-a-ramp.md). | The hover is on the tile and answers over the figure, and a click on a tile still swaps the view; the language foot states what it read and spends *only* where nothing was refused; the profile names its mode only where it differs from the effective one, on a centred line; the ramp's steps are 1 · 15 · 60 · 150 |

| **A11 · done** | **The naming call carries the language, and stops standing in front of the text** — [ADR 0188](../decisions/0188-one-call-names-the-file-and-the-language-and-it-stands-behind-the-insert.md). Asked as *would a model do this better*, answered by reading the callers: the call was already there, already in the wrong place, and already being made twice on the parked path. | One naming call per dictation, after delivery, answering title and language; the offline detector is the fallback and not the instrument; the tile measures the SPOKEN text, so Translate stops reporting the language it delivered |

**A2 carries the empty state and A5 does not.** The first draft of this sequence
put it in A5, which would have left every build between A2 and A5 showing a
fresh profile four zeroes and no instruction — the exact state decision 7
forbids. **A step that removes the only copy of something restores it in the
same step.**

**Stage B — what other tracks owe.** Each step belongs here only for the surface;
the data half is the named track's.

| Step | What | Waits on |
|---|---|---|
| **B1 · replaced** | ~~Recognized language on the record — pass `response.language` through~~. Measured on the delivered text instead ([ADR 0180](../decisions/0180-the-lane-that-most-dictations-take-never-names-a-language-so-the-language-is-measured-on-the-text.md)); the provider route delivers nothing on Groq or the local lane. **What is still owed by the speech track is language BREADTH elsewhere**: the per-profile dictation language is drawn and unwired, and Translate offers eight languages — neither is this tile's table, which covers what can be detected rather than what can be dictated or translated into | speech / core-hardening |
| **B2** | Target application on the record, plus the retention rule that names the new collection | privacy decision, runtime ownership |
| **B3 · done** | Lifetime counters that survive pruning — `core::activity_ledger`, one row per day, counts only ([ADR 0174](../decisions/0174-all-time-figures-need-a-record-that-does-not-forget-so-the-ledger-is-counts-per-day-and-never-text.md)) | this track |
| **B4** | Meetings and uploads as calendar origins | [`context-objects.md`](context-objects.md) |

**Stage C — the owner brief of 2026-08-17.** Nothing here is blocked and nothing
here rebuilds a decision: the calendar stays a GitHub-style year on the five-step
ramp, and the two views stay two views. Three groups, and **the dictation-list
group is here for A9's reason** — the same reading drives Home and History, the
two screens draw one component, and no track claims History.

| Step | What | Done means |
|---|---|---|
| **C1 · done** | **The left arrow lies about the end of the record.** `measure()` sets `left: node.scrollLeft > 1`, but the scroller does not rest at zero: `snapped()` is congruent to `GRID_LEFT_PAD` — deliberately, because a position congruent to 0 shaves a circle at both edges — so the settle handler parks the box at `scrollLeft = 5` and `5 > 1` stays true. Pressing it sets a negative position, the browser clamps to 0, and the settle puts it back at 5. The right arrow is correct because the far end lands on `max` exactly. **Fix the threshold, never the snap** — clamping `snapped()` to 0 reintroduces the shaved circle ADR 0183 took two passes to remove | The left arrow is disabled at the first column of the drawn year, in the same shape the right one is at the last, with a case that asserts it **after the settle has run** — a case that asserts straight after the click passes today and would have passed before the bug |
| **C2 · done** | **Two marker days, both green.** `2026-02-23`, WordScript's GitHub publication, hardcoded, labelled `WordScript Initiation`; and the day the reader installed the app. **A marker is a day with a name and not a count**, so it never joins the `dictations` ramp — a marker painted as activity is the invented figure ADR 0161 forbids, on the one display whose whole argument is that an unlit circle asserts something | Both days are drawn on the calendar and neither changes any figure the block reports |
| **C3 · done** | **The install date is a new ledger field**, because `started_on` is not one and its own doc comment says so — it is the first day a row was written. It belongs in `core::activity_ledger` and **not** in `AppConfig`: the ledger already travels in `BackupArchive` (ADR 0179) and is the one part of an archive that is **merged rather than replaced**, through `raise_to`, which already resolves `started_on` by *earliest wins*. In the config it would be overwritten by the exporting machine's on every import and then be a claim about somebody else's install | The date is written on a first run, survives a restart, and comes back from an export on another machine |
| **C4 · done** | **A marker is its own legend entry and its own tooltip line.** Both, or the green is decoration nobody can read. The legend is `aria-hidden="true"` today — right for an unlabelled ramp whose numbers are in the hover, **wrong the moment an entry carries a name** — so the marker's entry comes out of the hidden region. The tooltip carries the marker above the day's own readings, because it is why the reader stopped there | A reader who has never seen the calendar can say what a green circle means without hovering one |
| **C5 · done** | **A marker never overwrites activity.** A marker day with no dictation is a green fill; a marker day that was also dictated on keeps the accent fill **at its own ramp step** and takes a green ring. The ring is drawn inside the radius — `r = (size / 2) * 0.9` on a 15 px cell with a 3 px gutter — or two adjacent markers touch | Both facts are legible on the same cell, and the day's ramp step is unchanged by the marker |
| **C6 · done** | **A year that carries a marker is offered by the year picker.** It offers only years the ledger holds day rows for, plus the current year (ADR 0183) — so the 2026 publication date is unreachable on any machine installed in 2027 | Choosing the marker's year is possible on a machine whose ledger does not reach it |
| **C7 · done** | **Turnaround reads in seconds, and this is not a formatting change.** `DigitCounter` is documented as ten 7 × 5 digit frames with *no separator and no sign*, and `counterDigits` rounds — whole seconds would draw a 2,400 ms median as `2` and throw away every bit of a 25 ms histogram. **The shape that costs nothing: light the decimal point in the blank column that is already there.** `counterFrame` puts exactly one blank column between two glyphs so `11` does not read as one shape; one lit cell at the bottom of it is a decimal point at zero extra width, and the four reserved positions stay four | The tile reads `2.4`, its foot names seconds rather than `ms`, and the `ariaLabel` says what the foot says |
| **C8 · done** | **The standing facts move to the top of the hero, and this reverses a decision on the record.** ADR 0171 moved the shortcut *out* of the prominent position because an instruction is read exactly once. The owner wants it back, more prominent. Do it — **and write the reversal down by number**, in this track's own pattern, or the next reader finds 0171 and moves it back. Mechanically: `HeroFacts` before the display block, and the `border-top` becomes a `border-bottom` | The line is the first thing on Home and the ADR names 0171 |
| **C9 · done** | **The delivery badges go grey; only a real failure stays red.** `badgesFor()` gives `Clipboard only` and `Clipboard` the `warning` tone, which paints them in `--accent` — the product's orange, the same colour as its primary button. A delivery mode is a fact about how the text arrived, not a warning. **Unchanged and deliberately:** `Failed`, `Empty`, `Insert failed`, `Audio missing` keep `danger` | A healthy clipboard-only record is grey on both screens, and nothing that failed is |
| **C10 · done** | **Two actions stay on the row; the rest move into an overflow menu.** Six controls hang off every row and `restore` is conditional, so a list has rows of two widths. **The menu already exists** — `RowMenu` in `FloatBar.tsx`, with labelled entries, icons, hints and a disabled state — and ADR 0082 already answers a right-click with it, so the `…` and the right-click open **one** verb list. Delete goes into the menu; `Retry`'s disabled reason and `Reveal`'s must survive the move (ADR 0065). **ADR 0082's icon rule has to be qualified rather than ignored**: *what stays an icon is only what you repeat positionally* would send all six into the menu on a row with no reorder. Say why a transcript row differs — it is a record you copy repeatedly, not configuration you edit occasionally | Both screens draw the same two controls and the same menu, and no verb was lost in the move |
| **C11 · done** | **Delete gets an undo window — decided 2026-08-17: soft delete with a `Deleted · Undo` notice, not a confirm.** **This departs from ADR 0082's *deleting always asks*, and the ADR must say so by number.** The argument: a transcript row is deleted often and in runs, and a confirm on every row of a list you are clearing stops being read by the third one. **The runtime's delete is hard and takes the file with it** — `delete_transcription_history_entry` removes the entry *and* calls `remove_transcript_files`, and there is no restore — so the window is the frontend holding the row back and the `invoke` fires when it closes. **Three cases need an answer, not a default:** leaving the screen with one pending (flush it), closing the window with one pending, and a second delete inside the first one's window. **There is no toast surface in the shipped shell**: `src/components/ui/toast.tsx` is mounted nowhere, History has a one-line `notice` under its toolbar, Home has nothing | A deleted row can be brought back inside the window, is gone after it, and no pending delete dies with the webview |
| **C12 · withdrawn** | ~~A confirm on multi-selection in History~~. The brief asked for it; the owner then decided multi-selection is not wanted. There is no selection column, no `n selected` bar and no bulk command in the tree, and none is being built. **Kept rather than deleted** so the next reader finds the decision instead of the gap. If multi-selection ever lands the confirm is not optional — an undo window is right for one row and wrong for thirty | — |

**Developer Mode is not in this table and is deliberately elsewhere.** The same
brief asked for a Settings switch that hides every preview surface at runtime.
It is a release gate rather than a Home question — the build a stranger installs
must open on what is real — and it lives in
[`v1-release.md`](v1-release.md) as that track's Stage A. What touches this track
is one row of it: the `Meetings and uploads · Preview` line in the day tooltip
keeps its wording and starts reading a registry.

**Stage D — the owner brief of 2026-08-18.** One reading of the running block,
four items, all of them frontend. Nothing here is blocked and nothing rebuilds a
decision: the window stays rolling, the two views stay two views and the third
one is opened from a tile rather than from a third dot.

| Step | What | Done means |
|---|---|---|
| **D1 · done** | **The four-week label on a three-day record**, and the unit that had no ceiling — [ADR 0233](../decisions/0233-a-window-that-has-not-filled-says-how-full-it-is-and-a-figure-that-outgrows-its-unit-changes-unit.md). The window stays rolling; the ramp was chosen over restarting the counter every four weeks on decision 7's own argument, because a tumbling counter reads highest on day 27 and nothing on day 28 | The foot says `today`, `last N days` or `last 4 weeks` according to what the ledger can speak for, and the ramp's basis is `started_on` rather than `installed_on` |
| **D2 · done** | **The unit ladder**, owner's thresholds: minutes under 180, hours to 72 h, days above, one decimal drawn in the matrix (ADR 0191) | `4820 minutes` is impossible; the tile reads `4.6 hours` and the detail view spells its facts through the same function |
| **D3 · done** | **A metric opens its own view of the block** — [ADR 0235](../decisions/0235-a-metric-opens-its-own-view-of-the-home-block-and-it-draws-only-what-its-record-can-carry.md). The tile is a button and its click stops propagating; the background and the dots keep the counters/calendar swap; while a detail is open the hit layer is not rendered at all. Day/week/month/year, a grain offered only once the record reaches three buckets of it | Each of the four metrics opens a view that draws what its own record can carry — a series for the two that have one, a spread and a share table for the two that do not, each saying which it is |
| **D4 · done** | **The week starts on Monday**, in the calendar grid and in the week buckets, patched in the vendored heat map as well as in both callers | One dictation cannot land in two different weeks on one screen |

**Stage E — the owner brief of 2026-08-18, evening.** Stage D's views read
against 447 real dictations. Four items came back, then a fifth on what the
fourth produced. Durable form is
[ADR 0236](../decisions/0236-a-turnaround-is-read-by-band-and-by-cause-the-language-is-stored-on-the-record-and-a-control-that-will-not-act-is-not-shown.md).
**E3 is the only Rust in this track since B3.**

| Step | What | Done means |
|---|---|---|
| **E1 · done** | **Turnaround is read in bands, not in a 25 ms histogram.** 346 runs over 379 buckets drew 24 columns of 400 ms with 11 empty, and the hint under each was *this many dictations between two nearly identical times*. Five bands, edge set picked from the record's own p90 out of three; interior empties kept, trailing ones dropped; each hint carries the band's **share** | No column of the turnaround view can be hovered without producing a sentence somebody would say out loud |
| **E2 · done** | **And under the bands, what caused it.** The ledger's histogram carries no model, so the list reads the history records: vendor and model, runs, median, top five. The vendor is written out from the catalogue and prefixed `via` — the same recogniser runs at 1.0 s through one and 5.8 s through another on this machine, and the first build's unlabelled second word was read as possibly the model's author and possibly the profile | A reader can name which model and which vendor the wait belongs to, and the note says the clock also covers a transform model the record does not name |
| **E3 · done** | **The record stores the language it was counted as.** `TranscriptionHistoryEntry.spoken_language`, additive and `#[serde(default)]`, decided once in `record_entry_with_work_mode` and read by both the ledger write and `seed_from_history`. The label becomes `Not named`, because *too short* was one of two reasons and the other one was a rebuild losing the model's answer | A ledger rebuilt from history keeps the naming call's verdict for every record written after this, and the two reasons are no longer spelled as one |
| **E4 · done** | **The decimal gap is four columns with the mark in the middle two.** Seven of the ten glyphs reach their last column in the mark's rows, so the three-column build was clean behind `1` and one shape behind `3` | The mark cannot touch a glyph whichever digits stand either side of it, asserted over all 100 pairs |
| **E5 · done** | **The view dots leave the screen inside a metric.** Disabling them was the first answer and the owner read the pair still sitting there as an offer; `visibility` holds the row's space so the chart above does not lift | Nothing on an open metric view offers a switch it will not perform, and the block does not move when one opens |

### Stage F — the archive stopped sharing the index's lifetime

Opened 2026-08-19 out of E2, in the same session. The cause list reads history
rather than the ledger, so the owner asked how far back history reaches — and
from there, what happens to the Markdown files when it does not reach. Durable
form is
[ADR 0237](../decisions/0237-the-transcripts-are-their-own-collection-so-the-index-retention-stops-taking-them-and-the-archive-gets-a-reading-and-a-door.md).
**This is privacy work, not Home's**, and it is recorded here only because it
came out of an E2 reading and the session was already in the tree.

| Step | What | Done means |
|---|---|---|
| **F1 · done** | **The index prune leaves the files.** `prune_entries_for_runtime` stopped calling `remove_transcript_files`; the three intentional deletes keep it. Reverses one rule of ADR 0074 and keeps the rest | An entry that ages out is gone from History and its Markdown file is still on disk, asserted directly |
| **F2 · done** | **`transcript_store_status` counts and sizes the archive.** `files` and `bytes`, from a walk bounded by the store's own layout — a four-digit year, a two-digit month, `<DD-HHMM>-<slug>.md` | A screen can state how many transcript files this machine holds without guessing, and a file the reader added is not in the number |
| **F3 · done** | **`purge_transcript_archive` is the door.** The one call in the runtime allowed to walk the directory, bounded by the same shape check, pruning the month and year directories it emptied | The orphaned files a prune leaves behind can be removed from inside the app, and a file the reader wrote in that folder survives the purge |
| **F4 · done** | **`Transcript files` is a card on Privacy & Data.** Rule, reading, and a `Delete now` that appears only when there is something to delete — the `Audio from a failed dictation` card's shape, applied to the fourth collection. The retention hint above it stopped claiming the files | The screen answers *what is on this machine* for the archive as well as for the parked audio, and no row on it states a rule that is no longer true |

**What this does NOT fix, and the owner was told so before it was built:** the
cause list still reaches about five days, because `HISTORY_CEILING` is unchanged
at 1000 and history is what it reads. Raising the ceiling was offered as one of
four repairs and is not the one that was chosen; it stays open. **Closed by
Stage G**, and not by raising the ceiling: the list stopped reading history.
(**And the ceiling itself is gone as of Stage H** — the sentence above is kept in
its own tense because it is the record of what this stage knew.)

### Stage G — the index stopped being read on a clock and stopped carrying ballast

Opened 2026-08-19 out of Stage F's closing paragraph, in the same session. The
owner declined the repair that paragraph left open — *at a thousand records this
stops making sense, so optimise it* — and widened it to a rule: every function
gets only what it really needs. Durable form is
[ADR 0240](../decisions/0240-the-index-is-read-when-it-changes-carries-what-a-row-needs-and-the-turnaround-causes-move-into-the-ledger.md).

| Step | What | Done means |
|---|---|---|
| **G1 · done** | **The index is read when it changes.** `useTranscriptionHistory` listens on `wordscript-event` for the three payloads that write a record — `transcription`, `error`, `empty` — plus `visibilitychange` for an event lost while hidden. The five-second interval is gone and no slow poll replaced it | A test can advance 300,000 ms of fake time and see exactly one read, and a second read arrives on a `transcription` payload and not on an `audio_level` one |
| **G2 · done** | **The turnaround causes are an all-time ledger term.** `turnaround_causes`: `provider/model` to a 400-bucket histogram on the 25 ms axis, bounded at 64 keys, seeded once from the index, merged by field-wise maximum. `series.turnaroundCauses` reads the ledger and takes no records at all | The cause list's head reads `N runs all time`, `MetricDetail` no longer accepts a records prop, and the surface's note about pruning is deleted rather than reworded |
| **G3 · done** | **A list row is a summary and the record is fetched by id.** `TranscriptionHistorySummary` carries 25 fields with the two transcripts cut to 160 characters and a `transcripts_identical` flag; `transcription_history_record(id)` answers the whole entry, or `None` for an id the store does not hold. `summaries_snapshot` filters by reference and clones no record | Expanding a row, restoring one and copying one all still show the whole text, and 2,453 bytes a row became 1,113 on the reader's real index |
| **G4 · done** | **The index write is compact and atomic.** Temporary file plus rename, `to_string` rather than `to_string_pretty`, and the temporary is removed if the rename fails | A crash mid-write cannot leave a half-written index, asserted by a test that checks no `.json.tmp` survives a successful write, and 16.3% of the file's bytes stopped being indentation |
| **G5 · done** | **`HISTORY_CEILING` is 5,000.** Raised on a release-build measurement of serialise and write at five sizes, with the table in the constant's own doc block and the note that past 5,000 the answer is an append-only journal | The index reaches about twenty-five days at this machine's rate, and the constant carries the number that justifies it rather than a preference |
| **G6 · done** | **The review of G1–G5, and the two things the cut had taken with it.** Home's *View raw* drew the 160-character preview and never fetched the record, so the same disclosure showed the whole dictation on History and a silent truncation of it on Home; and the raw panel's shape claim — *the AI stage removed words and added none* — was being read off two cuts on both screens. `useWholeTranscript` is now the one fetch rule for both, `rawOf` takes the whole pair as a second argument, and the claim is withheld until it has one. History's rows are also built for the PAGE rather than for the set, which the ceiling at 5,000 made worth doing | Opening a long record on Home shows the whole text in both columns; a pair whose first line only drops fillers and whose tail the model invented gets the panel's own default rather than an exoneration; `npx vitest run` 953/953, `cargo test` 1006/0 |

**What this did NOT fix — and Stage H did, the same day.** Every term here was
still O(records) per dictation, because the index was one JSON array rewritten
whole; the write got 54.6% cheaper and atomic without ceasing to be linear. The
sentence that stood here said an append-only journal would make it O(1) and would
remove the cost basis the ceiling exists to bound. That is what H1 built and what
H2 then deleted: **0.006 ms to append at 10,000 records against 38.3 ms to
rewrite.** Kept rather than replaced, because the finding and its fix reading one
after the other is the shortest account of why the ceiling was the wrong lever.

**Three numbers this stage stated and the review corrected.** The summary carries
**25** fields rather than 24, and **16** stored fields no longer reach a screen
rather than 15 — both counted off the two structs rather than off the commit
message, and both fixed in SPEC, ARCHITECTURE and the G3 row above. ADR 0240
keeps its own wording, because an ADR is append-only and the correction lives
where corrections live. The third was `query_limit`, which still clamped a
caller's limit to the OLD ceiling's literal `1000` after G5 moved the ceiling to
5,000; nothing asks for more today, which is exactly why it would have been found
late.

### Stage H — the bound stops being a number of dictations, and all of it is built

**Opened 2026-08-19 immediately after the G6 review, and closed the same day: H1
to H5 are landed.** The owner read G6's answer, rejected the unit rather than the
number, and settled it in one line: **five thousand dictations is not a unit
that means anything, and the thing to bound is the storage rather than the file
count.** Durable form is
[ADR 0241](../decisions/0241-a-bound-on-stored-dictations-is-a-bound-in-bytes-so-the-index-becomes-a-journal-and-both-collections-get-a-warning-and-a-ceiling.md),
which carries the measurements, the premise that had to be corrected first, and
the reasoning;
[ADR 0242](../decisions/0242-the-journal-replays-into-a-list-the-archive-counts-itself-by-day-stamps-and-the-byte-that-is-bounded-is-the-content-byte.md)
is the mechanism and answers the four things 0241 handed forward. Read both
before touching this area; the table below is only the sequence.

**The premise the stage rests on, because it is the thing most likely to be
re-derived wrongly:** the index does NOT carry the statistics and has not since
ADR 0176. `activity.json` carries them — day rows bounded at 800, retired into
`retired` rather than dropped, two fixed 400-bucket histograms, a 64-key cause
map, 21,295 bytes for 497 dictations. The 5,000 ceiling costs the LIST and the
per-record detail, and costs no tile, no calendar and no histogram. Anyone who
reads the ceiling as a bound on the product's memory has the same wrong premise
the owner opened with, and will build the wrong thing.

**Built in the order H1, H2, H4, H3, H5** — H4 moved ahead of H3 because the
brief below says in its own row that it is a precondition, and a 10 GB ceiling
laid over a directory layout that cannot hold 10 GB is a number the product
states and cannot honour.

| Step | What | Done means |
|---|---|---|
| **H1 · done** | **The index is an append-only journal.** `history.jsonl`, one line per operation: a put for a record written or edited, a tombstone for one deleted. Oldest first in the file and newest first in the store, and a put of a held id replaces it IN PLACE so an edit never moves a record up the list. A torn last line costs that one record. Compaction runs on activation, on a wholesale replacement and past a doubling of dead weight, never on the dictation path. An existing `history.json` is read once, converted and deleted | Measured on a release build, both writes in one pass: **0.012 / 0.012 / 0.006 / 0.006 ms** to append at 1,000 / 2,000 / 5,000 / 10,000 records, against **3.5 / 7.5 / 19.3 / 38.3 ms** for the whole-file write it replaced. Flat against a line, and `measure_the_index_write_against_index_size` keeps both columns so the claim is never read against a number from another day |
| **H2 · done** | **`HISTORY_CEILING` is deleted** with its measurement table, its `query_limit` clamp and the row on Privacy & Data. `history_limit` went with it — out of `AppConfig`, out of `src/types/ipc.ts`, out of the export document and out of `prune_entries`, which now takes only a retention | No constant bounds the index in records and no screen names one. A config or export from any earlier build carries a field this one has no name for and loses it without losing the retention rule beside it |
| **H4 · done** | **The archive stops being walked whole.** `YYYY/MM/` shards to `YYYY/MM/DD/`, and a sidecar records a tally PER SHARD beside that shard's directory stamp — not one cached total, because a total is invalidated by what this product writes and by nothing the reader does. Files written before the shard are not moved and their month stays a shard of its own | `transcript_store_status` reads ~600 `read_dir` calls and one stat per day shard where it used to stat every file in the archive, on activation and on every Privacy visit. A reader deleting files by hand moves one stamp and only that shard recounts — asserted, along with one test that plants a disagreeing tally under a matching stamp, because every other test here would pass with the cache ignored |
| **H3 · done** | **Both collections have a byte budget: warning 5 GB, ceiling 10 GB, independently.** Content bytes rather than disk occupancy — occupancy is a property of the reader's block size, not of this product. Enforced at startup beside `prune_retained_captures`, never on the dictation path. A compaction is tried first, because a journal over its ceiling on dead weight must not answer by deleting live history; eviction is oldest first and goes to 90% rather than to the ceiling | A synthetic store past each threshold evicts oldest-first, stops at the target, leaves the other collection alone and leaves files the reader put in the folder where they are. Archive order is read off the path and the filename, never off `mtime` |
| **H5 · done** | **Privacy & Data reads both figures live.** The index gains the reading the archive already had, both warn past 5 GB, and the transcript card stops saying *Nothing prunes them* — true when ADR 0237 wrote it, and exactly the gap ADR 0241 closed | Both collections state a current size. `formatStoredSize` learned GB, because a ceiling stated in gigabytes read against `10240.0 MB` is the same number failing to answer the question the row asks |

**What this stage does NOT do:** it does not touch the ledger, and it must not.
`activity.json` is the one file here that cannot be rebuilt from anything else —
its `retired` totals speak for days whose records are gone (ADR 0179). It is
carried forward across every change above. Everything else on this machine is
disposable; the standing rule is in
[`IMPLEMENTATION.md`](../IMPLEMENTATION.md#local-data-on-this-machine-is-disposable).

**The one number that was not re-measured, and it is the open item this stage
leaves:** 684 bytes mean and 392 median per transcript, 2,432 bytes per index
record, 217 dictations a day. All three are from one 2.3-day window on one
machine. They were enough to reject a count ceiling and they are NOT enough to
have sized the budget — 5 GB and 10 GB are round numbers chosen so far above any
plausible use that being wrong about the rate by a factor of ten changes nothing.
That is a defensible way to pick a backstop and it is not a measurement. If the
thresholds ever have to be defended rather than merely stated, this is where the
work starts.

**And one consequence recorded rather than hidden:** the bounded byte is the
content byte, so on a 4 KB-block filesystem the archive's real disk cost at the
ceiling is several times the ceiling. ADR 0241 measured that slack at 86% of the
archive's footprint. The reasoning for choosing content anyway is in ADR 0242
section 3; the point here is that the number the product states and the number a
file manager shows are different, on purpose, and neither is wrong.

### Stage I — every reading on Home can exist indefinitely, and the ledger is what makes that true

**Opened 2026-08-19 the evening Stage H closed, and closed the same day: I1 to
I7 are landed.** The owner's constraint was one sentence — *every metric on Home
must be able to exist indefinitely* — and the sorting that preceded it found that
almost nothing on Home satisfied it. Durable form is [ADR 0243](../decisions/0243-a-reading-that-lasts-forever-is-a-mergeable-accumulator-per-period-so-the-ledger-grows-a-month-tier-and-every-field-says-when-it-started.md), which
carries the rule, the ladder, the two stamps, the measurements and the rejected
alternatives. Read it before touching `activity.json`; the table below is only
the sequence.

**The premise this stage rests on, because it is the one most likely to be
re-derived wrongly:** the ledger was all-time in its TOTALS and 2.2 years in
every SHAPE. `LEDGER_RETENTION_DAYS` was 800, a day past it was absorbed into one
opaque `retired` row, and every series started at the day after `retired_through`
— so the *Months* tab could never hold more than 26 buckets and **the *Years* tab
could never hold more than three, at any installation age.** `PERIOD_FLOOR` is 3,
so *Years* appeared at two years of use and then stopped growing forever. ADR
0176 protected the totals exactly as it set out to; nothing protected the shapes,
because nobody had asked for them yet.

**Built in the order I1, I2, I3, I4, I5, I6, I7** — the file's shape first,
because every reading step downstream is a consumer of it, and the write's safety
before anything started writing more into it.

| Step | What | Done means |
|---|---|---|
| **I1 · done** | **The ladder: `days` → `months` → `retired`, disjoint.** `LEDGER_RETENTION_DAYS` becomes `LEDGER_DAY_ROWS`, because 800 is now a working-set size and not a memory. `prune` folds a departing day into `months[YYYY-MM]` instead of into one blob; `months` is never pruned; `totals()` sums all three tiers, each row counted once. `raise_to` merges months per key, and `prehistory_through` — written once by the migration, merged by taking the LATER of two — marks the last day the opaque row speaks for, so the month series starts after the month that is split between a blob and rows | A day past the horizon leaves `days` and its figures arrive in its month, asserted against a total that does not move. Fifty years of month rows is **under 200 kB** against 4.9 MB of day rows. `months` is empty on a fresh migration and that is the correct reading, not a failure |
| **I2 · done** | **The write becomes atomic and compact.** `activity.json.tmp` then rename, so a crash costs the temporary rather than the ledger; `to_string` rather than `to_string_pretty`; seconds rounded to milliseconds on the way in. Frequency is unchanged and ADR 0243 §6 says why the index's answer does not reach this file | **21,326 bytes to 8,421 on the reporting machine, with the new accumulators already in it.** A failed rename removes the temporary rather than leaving a sibling. `4647.276553287982` becomes three decimals, rounded per run — which is not the same as rounding the total, and the case says so |
| **I3 · done** | **Five accumulators per day, and a stamp per field.** `turnaround_runs` and `turnaround_ms_sum` give an exact mean at two numbers; `turnaround_log[41]` gives the shape in quarter-octave buckets from 25 ms to 25.6 s plus an overflow; `languages` and `language_refused` give the split. `language_unasked` is DERIVED and never stored. `measured_from` maps field to first-measured day, merged by taking the EARLIER, and a series may not draw a period that starts before its field's stamp | Turnaround and languages have a history at every grain the ledger reaches. A ledger written before a field draws nothing for the days before it rather than a row of zeroes — which is every installation on the day this ships |
| **I4 · done** | **Two independent cuts of the turnaround, and a cap that keeps the sum.** `mode_causes` keys the same runs by `effective_mode`, beside `turnaround_causes` keyed by `provider/model`. Two one-dimensional cuts and never a cross-tab. The 64-key cap gains an `other` row | The rows sum to the histogram at every installation age, which is what the display already claimed. A provider literally named `other` cannot collide with the overflow row — asserted, because it is the one input that would make the sum lie again |
| **I5 · done** | **The reading side gets two horizons.** `series.ts` learns `tierOf` and `speaksFrom`: day and week grains reach as far as the day rows, month and year grains as far as the month rows, and `walk` takes the field it is walking so `measured_from` can refuse a period. `MetricDetail` draws turnaround and languages as histories beside their spreads, and a `Modes` list beside the model list | The *Years* tab grows for as long as the installation does. A grain the record cannot reach is not offered rather than drawn short. The `Modes` list is hidden below two rows, because a one-row comparison is furniture |
| **I6 · done** | **The ledger is re-read on the event, not on a key.** `useActivityLedger` loses its `reloadKey` and listens to the record-writing events and `visibilitychange`, the same as the history hook (ADR 0240). Home asks for the five rows it draws with a limit, and the owed-fallback list becomes `owed_fallback_only` in the runtime rather than a scan | Point 8 is deleted rather than repaired — there is no key left to stall. Home drew five rows out of 519 records and paid 519 summaries for it on every dictation; an owed fallback can be arbitrarily old, so only the runtime can find one and a limit never could |
| **I7 · done** | **Three surfaces stop under-saying what they know.** Markers become a table of `{date, label, kind}` rather than two constants, and the legend counts the kinds present. The rate tile states `Measured over: n of m`. *Not named* becomes *Too short to name* and *Never asked*, the second drawn only when it is not zero | A third marker is a row. The rate says over how many of the counted runs it was measured, which closes point 1 without a new field. The two language populations are named separately, and a record that asked about everything says so in a sentence instead of drawing a zero |

**What this stage does NOT do.** It does not touch the index, the archive or
their byte budgets (ADR 0241, ADR 0242). It recovers nothing from before a
field's `measured_from`, because nothing can. And it does not give the calendar
day resolution past the day tier — a year older than the day horizon is answered
at the month grain, and the year picker offers what a tier can speak for rather
than a year it would have to draw empty.

**The open item this stage leaves, and it is a decision rather than a defect:**
`LEDGER_DAY_ROWS` is still 800, which is now a working-set size for the calendar
rather than a bound on memory. Nothing measured says 800 is the right working
set; it is the number ADR 0176 chose for a different purpose, kept because
changing it in the same stage that changed its meaning would have made both
untestable.

### Stage J — the legacy paths are deleted rather than maintained, and two metrics stop under-saying what they know

**Opened 2026-08-19 within the hour Stage I closed, and closed the same day: J1
to J5 are landed.** The owner read the Languages metric Stage I had just shipped
and said `Never asked` makes sense only for him. Checking that found the row did
not measure what its own ADR claimed, and found a second defect nobody had
raised: the facts list mixed two generations of one counter and **summed to 653
against 586 dictations**. Durable form is [ADR 0244](../decisions/0244-there-is-no-legacy-in-a-developer-build-so-the-retired-tier-the-prehistory-stamp-the-schema-migrations-and-the-duplicate-language-counter-are-deleted.md).

**The premise this stage rests on, and it is a rule rather than a one-off:**
*there has never been a release build, so there is no installed base, so there is
no legacy.* A migration, a compatibility field or a conversion fallback earns its
place only if some machine outside this repository could hold the data it
converts. **The question is not whether it could ever be needed — everything
could — but whether any installation holds it.** And the two defects above are
why that is not merely a cost argument: a path exercised by one developer and no
user is still exercised, and its output reaches the screen where nobody can see
it is wrong.

**Built in the order J1, J2, J3, J4, J5** — the ledger's shape first, because
every reading below it is a consumer, and the accumulated store deleted before
any of it, so nothing was written against data the build was about to stop
understanding.

| Step | What | Done means |
|---|---|---|
| **J1 · done** | **The accumulated store is deleted, not migrated.** `activity.json`, `history.jsonl` and 492 transcript files, backed up once and dropped. The decision applied to its own author: keeping them meant keeping every construct below | The host restarts on nothing and writes a ledger from scratch. Local data on this machine was already declared disposable in [`IMPLEMENTATION.md`](../IMPLEMENTATION.md#local-data-on-this-machine-is-disposable); this is the first stage to act on it wholesale |
| **J2 · done** | **`retired`, `retired_through` and `prehistory_through` are deleted**, with the `schema < 2` and `schema < 3` branches that filled them. The blob existed because pruning destroyed a day's shape; ADR 0243 removed that reason twenty-four hours earlier, and the prehistory stamp had been written the same day to describe the blob's edge. `LEDGER_SCHEMA` keeps the value 3 rather than being renumbered — a version stamp that counts backwards is worse than one with gaps | `totals()` is `months + days`. The tier ladder is two rows deep and nothing in the file is ever opaque. A ledger this build creates states this build's stamp on the FIRST write, which it did not before — invisible on every screen, and the reason it has a case of its own |
| **J3 · done** | **One language counter.** The lifetime map that had counted since ADR 0180 is deleted; the per-period rows are the only source, and `ledgerLanguages()` reads them. Two copies of one fact (ADR 0123) had drifted by 67 runs | The chart, the tile and the facts list come off one number. The surviving counter is the tiered one because it answers every question the lifetime map could and one it could not — per period, with a `measured_from` stamp |
| **J4 · done** | **`Never asked` is deleted and the denominator says what it counts.** `Named: n of m` states `m = named + refused`, the runs a language was asked of — the same construction the speaking rate uses for `Measured over`. The runtime increments exactly one of the two halves on every counted dictation, so they account for it exactly | The two rows sum to the figure above them at every age and on every machine. The lifetime dictation count stays on the tiles, where it answers a different question |
| **J5 · done** | **The two turnaround cuts say they are two cuts, in the heading.** `What the mode cost` reads `the same 474 runs`, or `470 of the same 474 runs` where a record named no mode — a shortfall that existed since ADR 0243 and was disclosed only in a source comment claiming the surface stated it | The reader's own question is answered where they are looking, rather than by a sentence under both lists that arrives after they have answered it wrongly |

**What this stage does NOT do.** It does not touch the index, the archive or
their byte budgets (ADR 0241, ADR 0242), and it does not touch ADR 0243's
accumulator rule, day-to-month ladder or `measured_from`. What it removed from
ADR 0243 is only the part that existed to carry one developer's file forward.

**And the window it opens closes on its own.** Reading a pre-0244 ledger is safe
exactly once, because no such file exists anywhere. **At the first release build
that stops being true**, and every schema change from then on owes its users a
path. ADR 0244 says so in its own Decision section rather than leaving it to be
inferred from the absence of code, and gate **G9** on
[`v1-release.md`](v1-release.md) carries the reminder to where a release is
checked — the same gate ADR 0112 opened for the config, now stating both halves
of the window for all four on-disk shapes.

### Stage K — the wait is measured in two stages, and every metric detail states its reading before it draws the evidence

**Opened the day after Stage J closed, by the owner reading the screen Stage J
had corrected.** Stage J made the two turnaround lists SAY they are two cuts of
one total; Stage K found that saying so was the whole of what could be said,
because both cuts were the same number. The heading `Which model heard it`
promised a stage the record had never held.

**Built in the order K1, K2, K3** — the measurement first, because a surface
that states a stage before the runtime measures one is the defect this stage
exists against.

| Step | What | Done means |
|---|---|---|
| **K1 · done** | **The runtime measures where the wait went.** `TurnaroundFacts { total_ms, heard_ms }` replaces the loose `Option<u64>` on the history, session and insert paths; `heard_ms` is stamped when the provider returns and before the staleness check, so an aborted run measures the same interval; the rewriting is the remainder, derived once in the ledger funnel | A dictation records two figures where it recorded one, on every path including the parked preview commit. The pair is one parameter, so the two durations cannot be swapped silently |
| **K2 · done** | **Each cut of the turnaround carries the stage it owns.** `LedgerCause.heard_buckets` inside `turnaround_causes`, and `mode_transform_causes` beside `mode_causes` — same 400-bucket 25 ms axis, same merge rule, written only where a split was measured. `LEDGER_SCHEMA` stays 3: the new fields are `#[serde(default)]` and a developer build converts nothing (ADR 0244) | A stage median is read off its own histogram. An empty stage histogram means never measured and never nought, and the two states cannot collapse |
| **K3 · done** | **One table with named columns, and a lead line above it.** `Which model heard it` and `What the mode cost` are one `Split` block with a `by model` / `by mode` toggle and the columns `runs`, `heard in` / `rewrote in`, `in total`. Every `ws-metric-note` paragraph is deleted, every chart takes a `title`, and each of the four details opens with a figure-first sentence and one middle-dot line of qualifiers | The screen's subject is legible without reading a paragraph, and the reader is never asked to work out whether one figure is inside another. Where no split has been measured yet, the stage column is not drawn and one self-deleting sentence says when it will be |

**What this stage does NOT do.** It writes no migration and no backfill. The
stage histograms start empty on every installation including this one, because
no stored record holds the split — and a seed that guessed at it would be the
plausible wrong number this track exists against.

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

**A MATRIX GLYPH IS GRADED BY LOOKING AT IT, AND THE ARITHMETIC BEING RIGHT
PROVES NOTHING — NEW, STAGE C.** The counter's decimal point was correct at every
step: the right column, the right row, inside the frame, under test. It was also
unreadable, and `1.0` was reported as reading `10`. Then the fix was correct and
the mark merged with the digit beside it. **Both failures are about the SPACE
around a mark rather than about the mark**, and a frame is 4 px dots on 6 px
pitch — everything is nearly touching everything, so a gap that is not visibly
larger than the standard gap carries no information at all. Same family as the
geometry trap above: the unit suite sees a lit cell at `[6][17]` and cannot see
that a reader sees one number.

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

**A RECORD THAT FORGETS IS THE CALENDAR'S PROBLEM, AND THE FILE THAT FORGETS HAS
CHANGED TWICE.** Originally the index: a saturated history could not vouch for
any day before its own oldest record, even one inside the retention horizon.
ADR 0176 moved the statistics into the ledger, so the day rows are what roll
now; ADR 0241 replaced the index's count ceiling with a byte ceiling that evicts
oldest-first, which forgets the same way under a different name. **The rule
survived all three.** Any surface that draws absence — a streak, a gap, a "you
haven't dictated since" — has to start at the horizon the record can speak for
or it states a fact the file cannot support. That horizon is `speaksFrom(ledger,
period)` since ADR 0243, and it is **one answer per grain**: `ledgerSpeaksFrom`
for days and weeks, `ledgerMonthsSpeakFrom` for months and years. `activityWindow`
was its first name and is gone. **`0` and `unknown` are different, so are `unlit`
and `not drawn`, and so is a period before its field's `measured_from`.**

## The prompt for the next session

**Stage A, and Stage C through Stage K, are all closed** — A1 to A11, C1 to C11,
D1 to D4, E1 to E5, F1 to F4, G1 to G6, H1 to H5, I1 to I7, J1 to J5 and K1 to
K3 are landed, C12 stays withdrawn. Stage H, I, J and K were each opened by the
owner using what the session before it landed, and each was built the same day;
Stage J was opened within the hour Stage I closed, and Stage K the day after,
each by reading the screen the stage before it had just shipped. Read the record
sections above before anything else, in particular the A3/A4/A5 one, *What the
readings actually measure*, and the Stage C, D, E, G, H, I, J and K ones.

**Stage I's first section, Stage J's first two and Stage K's first are the ones
to read even if you read nothing else.** Between them: four of the eight items
this page raised misdescribed the code they pointed at, a row shipped with a
label that did not match what it measured, a source comment asserted a behaviour
the surface did not have, and two headings named a stage the record had never
held. **Everything on this page is evidence and nothing on it is a source.**

Work in the repo root on `main`. Do not create a branch. **Seven other tracks
work in the same tree** — see [`../IMPLEMENTATION.md`](../IMPLEMENTATION.md) — so
run `git status` and `git log --oneline -5` before you start, and stage your own
paths. Never `git add -A`. **0248 is the next free ADR number unless the tree
says otherwise — grep, and grep again immediately before you write the file.**
Stage D cited 0234 twelve times in source and lost the number to another track
while the session was running; Stage G was grepped clean at its start, cited 0238
across 14 files over the hours that followed, and lost it anyway, at a cost of a
`sed` over 14 files. Stage E, F, H, I and J all wrote the ADR file the moment the
number was known and none of them lost it; Stage K did not, drafted against
0245 while 0245 and 0246 were already on disk, and paid for it with a rename
across 22 citations. The rule is not *grep first*, it is
**write the file the moment you know you need a number.**

### What is left is Stage B, and it is still not yours to start

Every remaining row waits on another track's data, and the table under *What can
be wired today* is the authority on which is which. **Do not build the surface
for a row whose data has not landed**; a drawn tile with no field behind it is
the thing this track spent Stage A making impossible.

| Row | Waits on |
|---|---|
| **B1 · replaced** | The provider route delivers nothing (ADR 0180). What is still owed by the speech track is language BREADTH elsewhere, which is not this tile's table |
| **B2** | The target application on the record, plus the privacy decision that names the new collection. `Apps` is RETIRED rather than deferred (ADR 0175) — do not bring the tile back without re-opening that ADR |
| **B4** | Meetings and uploads as calendar origins — [`context-objects.md`](context-objects.md). The tooltip already holds their line, unwired and tagged |

**So a session opening this page should probably not be a home-activity
session.** If the owner brings new readings they open a Stage L and this page is
where it goes. If they do not, the five below are what this track still has to
say, and every one of them is a PROPOSAL rather than a task.

### Five things to raise

1. **The second clock inside the turnaround is on the record — ANSWERED by
   Stage K.** The clock still stops when the TEXT exists (ADR 0181), but the
   interval is now split: `heard_ms` is stamped when the provider returns and
   the rewriting is the remainder (ADR 0247). What this item predicted held —
   it needed a second timestamp on the record, and it changed what existing
   records can be compared against, which is why the stage histograms start
   empty everywhere rather than being backfilled. **What is still open is the
   third clock**: the recogniser-output repair between the two stages is
   counted with the mode, on the argument that it is sub-millisecond string
   work. Nothing has measured that argument.
2. **`LEDGER_DAY_ROWS` is 800 and nothing measured says it should be.** ADR 0243
   changed what the number means — the calendar's working set, not a bound on the
   product's memory — and deliberately did not change its value in the same
   stage. The calendar draws a year at a time and the day tier is its only
   source, so the honest question is *how many years back should a reader scroll
   at day resolution*, and that is a product decision rather than an arithmetic
   one. Roughly 330 bytes a day row: a decade is 1.2 MB.
3. **The three per-record numbers are re-measured, still one machine, and the
   machine has since been wiped.** 685 bytes mean and 386 median per transcript,
   2,550 per index record, 187 dictations a day — the Stage I record carries what
   they say about the byte budgets, which is more than Stage H could say, and the
   archive figures held to within a byte across two windows. **They still
   describe one reader**, and Stage J deleted the store they were measured on, so
   a third window starts from zero. If the thresholds ever have to be defended
   rather than stated, a second machine is the work.
4. **Nothing else on Home is a candidate for a tile until ADR 0243 §1 admits
   it.** A reading goes on Home only if it can be stored as a fixed-size
   mergeable accumulator per period. A distinct-count, a most-recent-value or an
   exact percentile cannot, and belongs on a surface that speaks for a window and
   says so. A gate on future work rather than an open question, here so a session
   proposing a fifth tile checks it before designing one.
5. **The no-legacy licence expires at the first release build, and nothing will
   remind you.** ADR 0244 deleted the ledger's schema migrations because no
   installation outside this repository holds a file to convert. **That stops
   being true the day a release ships**, and from then on every schema change
   owes its users a path. **The reminder lives on gate G9** of
   [`v1-release.md`](v1-release.md), which is the row a release is actually
   checked against — an ADR is not read on the day somebody cuts one. G9 names
   the four shapes that go out before the release and the same four that owe a
   path after it: `activity.json` with its `LEDGER_SCHEMA`, `history.jsonl`, the
   transcript archive's layout and the config.

**Answered and kept for findability:** the old items 1, 2, 4, 6, 8 and 9 were
built in Stage I; the old item 3 was DECIDED in ADR 0243 §8 — *if multi-selection
ever lands on History, a multi-row delete confirms rather than offering an undo.*
The old item 7 was reversed by the owner within an hour of being raised and its
record is in the Stage H section.

### Rules that still have teeth here

1. **Never render a number the runtime did not produce.** A drawn reading carries
   `PreviewTag` and shows no figure at all (ADR 0161).
2. **`unlit` and `not drawn` are different claims**, and so are `0` and `unknown`.
   Anything that draws absence starts at the horizon its grain can reach. A chart
   column has the same two states: `empty` is not a zero, and a week with no
   dictation has no speaking rate at all. **Since ADR 0243 there is a third**: a
   period before its field's `measured_from` is not drawn. The horizon is
   `speaksFrom(ledger, period)`, one answer per grain — not the single
   `activityWindow` the older sections of this page still name, which no longer
   exists.
3. **A stored figure that is the remainder of two others is a defect**, and so is
   a second copy of one fact. `raise_to` merges field by field, so a stored
   remainder can survive a merge that moved the numbers it is the remainder of;
   and two counters over one quantity drift, which is what put 653 on a screen
   measuring 586. Derive the remainder, keep one counter.
4. **A comment asserting a behaviour is not that behaviour.** `add_mode_cause`
   carried *the rows then sum to less than the total, which the surface states
   rather than papers over*, written in the session that shipped a surface which
   did not state it. If a source comment claims a screen says something, open the
   screen.
5. **No compatibility path without an installation that needs it.** Ask *does any
   machine outside this repository hold that data* rather than *could this ever
   be needed*. See item 5 above for when this rule expires.
6. **A dev host may be running.** Check `pgrep -af "tauri dev"`. Do not write
   `vite.config.ts` while one is up, and batch anything under `src-tauri/` into
   one pass — say out loud that a rebuild is coming before you do it. **The
   shell's cwd is state**: `cd src-tauri && cargo test` leaves the shell there.
   **And a `pkill` pattern matches your own shell's command line** — killing
   `tauri dev` by name kills the command that typed it, which cost two attempts
   in Stage J. Kill by pid, or build the pattern so it cannot match itself.
7. **A capture measurement may be running.** Take
   `wc -l ~/.config/WordScript/logs/wordscript-runtime.log` before and after and
   report both; no heavy builds, `cargo test` included, during one.
8. **Measure geometry in a browser, do not read `shell.css` and believe it.**
   Stage A's corrected trap is three separate ways that goes wrong, **Stage D is
   the same rule one step up — render the chart and look at it**, **and Stage E
   is one step up again: render the REAL workspace over the dev server with
   `__TAURI_INTERNALS__` stubbed and this machine's own `config.json`,
   `activity.json` and `history.json` behind it.** Note that as of Stage J this
   machine's store is EMPTY, so that technique needs the owner to dictate first.
9. **A migration runs on read and persists on the next write**, so a file checked
   too early still says the old schema and nothing is wrong. Neither
   `activity.json` nor `history.json` has ever had a test for its own
   conversion — both were watched on the live store instead, backed up first.
10. **A matrix glyph is graded by looking at it at its real size.** Stage C's own
    trap, and it cost two rounds: the arithmetic was right both times.
11. **The owner does not want every change tested.** Said in as many words on
    2026-08-17. A case earns its place where a fact could silently move — a
    derivation, a refusal, a timing rule — and not where a constant changed.
    **And a case that fails because the behaviour was deliberately removed gets
    REWRITTEN, not deleted**: in Stage J two such rewrites caught a defect in the
    deletion itself, which deleting them would have shipped.
12. **An `Accepted` ADR is not a closed door.** Said in as many words on
    2026-08-19: a decision recorded as fixed is not fixed, and it gets revisited
    the moment something better exists. Stage I overruled ADR 0176's
    day-row bound and Stage J overruled parts of ADR 0243 one day after it was
    written. What an ADR guarantees is that the reasoning is findable before it
    is overturned, not that it never is.

**Validation:** `npm test`, `npm run build`, and `cd src-tauri && cargo test` if
Rust moved. Quote the counts as a delta against the baselines you measure at the
start. Baselines at the close of Stage K: **969 frontend cases over 58 files**
and **1043 Rust cases**, with `npx tsc --noEmit` clean. **They are a sanity check
and not a baseline**, because seven other tracks write into this tree: Stage F
closed with three of its five new Rust cases and one of its three new frontend
cases belonging to one of them, counted as its own until the log said otherwise.
Measure your own start. Run `npm audit` if anything lands in `package.json`; the
intent is that nothing does.

**Before you stop**, write your record into this page above the sequence, update
the rows you closed, write the next ADR in the track's range, and write the next
brief in place of this prompt.
