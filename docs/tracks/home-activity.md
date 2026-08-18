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

> Diese Funktion gibt es hier erst seit drei Tagen. Dementsprechend haben die
> letzten vier Wochen bei mir nur 200 Minuten erspart.

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
*mechanisch ist es ausgeschaltet, aber visuell ist es noch da*. A lit dot with an
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

**A HISTORY FILE IS NOT AN APPEND-ONLY LOG, AND THE CALENDAR IS THE SURFACE THAT
FORGETS IT.** Pruning has two arms and the count arm is the one that catches
people: a saturated history cannot vouch for any day before its own oldest
record, even one inside the retention horizon. Any future surface that draws
absence — a streak, a gap, a "you haven't dictated since" — has to pass through
`activityWindow` or it will state a fact the file cannot support. **`0` and
`unknown` are different, and so are `unlit` and `not drawn`.**

## The prompt for the next session

**Stage A, Stage C, Stage D and Stage E are all closed** — A1 to A11, C1 to C11,
D1 to D4 and E1 to E5 are landed, C12 stays withdrawn. Read the record sections
above before anything else, in particular the A3/A4/A5 one, *What the readings
actually measure*, the Stage C one, the Stage D one and the Stage E one: all five
carry findings that are not in the tree's own comments.

Work in the repo root on `main`. Do not create a branch. **Seven other tracks
work in the same tree** — see [`../IMPLEMENTATION.md`](../IMPLEMENTATION.md) — so
run `git status` and `git log --oneline -5` before you start, and stage your own
paths. Never `git add -A`. **0237 is the next free ADR number unless the tree
says otherwise — grep, and grep again immediately before you write the file.**
Stage D cited 0234 twelve times in source and lost the number to another track
while the session was running; Stage E wrote 0236's file first and scattered the
citations after, which is what that trap actually asks for.

### There is no open stage. What is left is Stage B, and it is not yours to start

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
session.** If the owner brings new readings, they open a Stage F and this page is
where it goes — that is what Stage D and Stage E both were, each opened by one
evening's use of what the session before it landed. If they do not, the four live questions below are what this track
still has to say, and every one of them is a PROPOSAL rather than a task.

### Four things to raise, and none of them is a row yet

1. **`Words per minute` is throughput, not articulation — and this is the one
   that has been open longest.** ADR 0177 fixed the numerator and the
   denominator, so the tile is now a speaking rate; what is still true is that
   the SPEECH clock only exists from ADR 0177 forward. Nothing before it can be
   re-measured. That is a fact about the record rather than a defect.
2. **A marker is a shape this display now has and uses twice.** If a third ever
   arrives — a release, an anniversary, a day the reader names themselves — the
   legend's one word stops being enough and the hover becomes the only place a
   name is readable. **That is the point at which markers need a list rather than
   two constants.**
3. **The undo window is one row deep and says so** (ADR 0195). If multi-selection
   ever lands on History, the confirm is not optional — an undo window is right
   for one row and wrong for thirty, and C12 was withdrawn rather than deleted so
   that this decision is findable rather than re-derived.
4. **Turnaround and languages will still have no history in a year.** Stage D
   drew what the record can carry and said so in one line each, which is honest
   and is not the same as satisfying. Giving either one a series means a new day-
   row field, which means the ledger's shape, `raise_to`, the backup merge and a
   migration — **a Stage B-sized decision that belongs to whoever owns the
   ledger, not to a chart.** Do not add the field to make a tab appear.
5. **The turnaround the list charges to a model is not all that model's.** The
   clock stops when the TEXT exists (ADR 0181), so a mode that rewrites what was
   said has a second model inside the same interval and the record names only
   the recogniser. Splitting the clock would mean a second timestamp on the
   record — cheap in isolation, and a change to what every existing record can
   be compared against. **`effective_mode` is already there**, so a per-mode cut
   of the same list is the free version of this and is the one to offer first.
6. **`Not named` will hold 91 runs forever.** ADR 0236 stops the next rebuild
   from losing an answer; it recovers nothing. If the tile ever needs to
   distinguish *refused* from *lost*, the field that would say so is on records
   written from 2026-08-18 onwards and on no others.

### Rules that still have teeth here

1. **Never render a number the runtime did not produce.** A drawn reading carries
   `PreviewTag` and shows no figure at all (ADR 0161).
2. **`unlit` and `not drawn` are different claims**, and so are `0` and `unknown`.
   Anything that draws absence goes through `activityWindow`. A chart column has
   the same two states: `empty` is not a zero, and a week with no dictation has
   no speaking rate at all.
3. **A dev host may be running.** Check `pgrep -af "tauri dev"`. Do not write
   `vite.config.ts` while one is up, and batch anything under `src-tauri/` into
   one pass — say out loud that a rebuild is coming before you do it.
4. **A capture measurement may be running.** Take
   `wc -l ~/.config/WordScript/logs/wordscript-runtime.log` before and after and
   report both; no heavy builds, `cargo test` included, during one.
5. **Measure geometry in a browser, do not read `shell.css` and believe it.**
   Stage A's corrected trap is three separate ways that goes wrong, **Stage D is
   the same rule one step up — render the chart and look at it** (five defects
   green in Vitest and wrong on the screen, including a line drawn at 16 px by
   `.ws-win svg`, the trap the calendar's own file documents), **and Stage E is
   one step up again: render the REAL workspace over the dev server with
   `__TAURI_INTERNALS__` stubbed and this machine's own `config.json`,
   `activity.json` and `history.json` behind it.** Synthetic data cannot show you
   that one recogniser appears under two vendors.
6. **A matrix glyph is graded by looking at it at its real size.** Stage C's own
   trap, and it cost two rounds: the arithmetic was right both times.
7. **The owner does not want every change tested.** Said in as many words on
   2026-08-17. A case earns its place where a fact could silently move — a
   derivation, a refusal, a timing rule — and not where a constant changed.

**Validation:** `npm test`, `npm run build`, and `cd src-tauri && cargo test` if
Rust moved. Quote the counts as a delta against the baselines you measure at the
start. Baselines at the close of Stage E: **942 frontend cases over 56 files**
and **992 Rust cases**. Run `npm audit` if anything lands in `package.json`; the
intent is that nothing does.

**Before you stop**, write your record into this page above the sequence, update
the rows you closed, write the next ADR in the track's range, and write the next
brief in place of this prompt.
