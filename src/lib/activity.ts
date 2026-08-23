/**
 * WHAT THE RECORD SAYS ABOUT HOW YOU DICTATE.
 *
 * Every reading here is derived in one place, under test, and carries the count
 * it was computed over — because a rate whose denominator quietly skipped half
 * the runs is a plausible wrong number, and a plausible wrong number is the
 * failure class this repository keeps a whole track for.
 *
 * THE SOURCE IS THE LEDGER AND NOT HISTORY, and that is the load-bearing fact.
 * The index is pruned on every read by age — and by a record count too, until
 * ADR 0241 deleted it — so a total summed from it grows and then runs BACKWARDS
 * as the oldest records pass the retention window. `core::activity_ledger` keeps one row per day — counts and
 * durations, never text — and does not forget, which is what lets these figures
 * say *all time* at all. The first build of this module read history and could
 * not.
 *
 * `capture_integrity` IS NULL MORE OFTEN THAN IT LOOKS — absent on a retry,
 * which never touched a microphone, and on every record written before the
 * measurement existed. The ledger counts those runs' WORDS but not their
 * SECONDS, so `timed` and `total` differ and every rate says which it used.
 */

import { TRANSLATE_LANGUAGES } from "@/types/ipc";

/** The typing speed `ledgerTimeSaved` measures against when the config names no
 *  other — the runtime's `default_typing_baseline_wpm`.
 *
 *  IT IS AN ASSUMPTION AND NOT A MEASUREMENT. Nothing in this product has ever
 *  watched the reader type, and nothing will; 40 words a minute is the ordinary
 *  figure for sustained prose typing. That is exactly why the surface renders
 *  the result with `≈` and names the baseline: a number derived from a guess may
 *  be shown, but it may not be dressed as a reading.
 *
 *  AND IT IS NOW A SETTING, because it is the whole figure (ADR 0178). Measured
 *  on four weeks of real dictation the same records read 43 minutes saved at 40
 *  wpm and 15 at 60 — a threefold swing on a number nobody chose. Somebody who
 *  writes all day is faster than the ordinary figure and has to be able to say
 *  so; this constant is only what a config that has never said anything means. */
export const TYPING_BASELINE_WPM = 40;

/** Time saved is a rolling window rather than a total, per rule 6.
 *
 *  FOUR WEEKS, AND THE OWNER PICKED THE NUMBER. Everything else on this row is
 *  all-time now; this one stays windowed because a lifetime "time saved" stops
 *  being something a reader can hold — twenty hours saved since March is a
 *  trophy, four hours saved this month is a fact about your month. Four weeks
 *  rather than a calendar month so the figure never jumps because February is
 *  short, and it is the calendar's own unit. */
export const SAVED_WINDOW_DAYS = 28;

const DAY_MS = 24 * 60 * 60 * 1000;

/** THE UNITS A SAVED DURATION MAY BE READ IN (ADR 0233).
 *
 *  THE FIGURE OUTGROWS ITS UNIT LONG BEFORE IT OUTGROWS THE COUNTER. Four weeks
 *  of the owner's own dictation come to roughly 3,700 minutes, and `3700` is a
 *  true number in a unit nobody can hold — the same defect ADR 0191 fixed on
 *  turnaround, where `2400` was a true figure in milliseconds. The counter would
 *  not have lied about it: `RESERVED_POSITIONS` widens the frame rather than
 *  dropping a digit. It would simply have stopped being readable.
 *
 *  SO THE UNIT CLIMBS AND THE NUMBER STAYS SMALL. Three hours is where a person
 *  stops counting in minutes, and three days is where they stop counting in
 *  hours; both thresholds are the owner's. One decimal place above minutes,
 *  because `3` hours where the truth is 3.4 throws away a fifth of the reading,
 *  and the counter has drawn a decimal point since ADR 0191. */
export type DurationUnit = "minutes" | "hours" | "days";

export interface DurationFigure {
  value: number;
  /** What the counter is to draw it with — 0 in minutes, 1 above. */
  decimals: number;
  unit: DurationUnit;
}

/** Minutes at which the reading changes to hours. */
export const HOURS_FROM_MINUTES = 180;
/** Hours at which it changes to days. */
export const DAYS_FROM_HOURS = 72;

/**
 * A count of minutes as the figure and unit it should be read in.
 *
 * THE THRESHOLD IS TESTED AGAINST THE ROUNDED VALUE AND NOT THE RAW ONE.
 * Otherwise 179.7 minutes draws as `180 minutes` — a reading that is both past
 * the boundary and on the wrong side of it, which is the sort of off-by-one a
 * reader notices exactly once and never trusts again.
 */
export function durationFigure(
  minutes: number | null | undefined,
): DurationFigure | null {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return null;
  const held = Math.max(0, minutes);
  if (Math.round(held) < HOURS_FROM_MINUTES) {
    return { value: held, decimals: 0, unit: "minutes" };
  }
  const hours = held / 60;
  if (Math.round(hours * 10) / 10 < DAYS_FROM_HOURS) {
    return { value: hours, decimals: 1, unit: "hours" };
  }
  return { value: hours / 24, decimals: 1, unit: "days" };
}

/**
 * A figure, and the two counts that say what it is a figure OF.
 *
 * `timed` is how many records the value was computed over; `total` is how many
 * had text to contribute and could have, had they carried a clock. The surface
 * prints both, because `148` over three records and `148` over three hundred are
 * not the same claim.
 */
export interface ActivityReading {
  value: number;
  timed: number;
  total: number;
}

/* ════════════════════════════════════════════════════════════════════════════
   THE CALENDAR'S DAY BUCKETS.

   The tiles answer *who are you, averaged*; these answer *what did you do, day
   by day*. Same module, because a day's reading is derived from the same
   records by the same rules, and a second place to divide words by seconds is a
   second place to get it wrong.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The longest window the display will ever draw (decision 8). Twenty-six weeks
 *  at roughly double a GitHub cell reads as a matrix rather than a spreadsheet,
 *  and *how was my half-year* is the honest question for a tool used daily. It
 *  is a CAP, not a promise: what is actually drawn is what the record can speak
 *  for, which on most machines is far less. */
export const ACTIVITY_WEEKS = 26;

/** The lower bound of each lit step. Step 0 is unlit and is not in the list.
 *
 *  FIXED THRESHOLDS RATHER THAN QUARTILES OF THE MAXIMUM, which is what GitHub
 *  does and what the vendored library's `convertPanelColors` does. A ramp scaled
 *  to the busiest day means a colour changes meaning when an unrelated day gets
 *  busier — the same two dictations are step 4 one week and step 1 the next, and
 *  the reader learns nothing they can carry. Worse, a history holding exactly
 *  one dictation would paint it the brightest step, which reads as a heavy day.
 *  Fixed steps make the colour an absolute claim about a day.
 *
 *  AND THE SCALE WAS AN ORDER OF MAGNITUDE OFF (ADR 0187). It stood at
 *  `[1, 3, 6, 11]`, which is a ramp for somebody who dictates a handful of notes
 *  a week. The first day this product measured in full ran to 104 dictations and
 *  6,065 words — and the owner called it a LIGHT one, on a Sunday. Every step
 *  above the first was therefore reached before breakfast, every real day painted
 *  the brightest colour, and a ramp whose every value is the maximum is a ramp
 *  that says nothing. What the four steps name now:
 *
 *    1 — you dictated  ·  15 — a working session
 *   60 — a heavy day   ·  150 — an exceptional one
 *
 *  THE FIRST STEP STAYS AT ONE AND MAY NEVER RISE. An unlit cell asserts that
 *  nothing was dictated that day; raising the floor would spend that claim on
 *  days somebody actually worked, which is the one thing this grid must not
 *  say. */
export const ACTIVITY_STEPS = [1, 15, 60, 150];

/** A day, as the calendar and its tooltip need it.
 *
 *  Dictations only. Meetings and uploads are origins that do not exist yet, and
 *  they are deliberately ABSENT rather than zero — a zero claims a count. The
 *  tooltip states them as lines with no reading; it does not read them here. */
export interface ActivityDay {
  /** `YYYY/M/D`, the vendored heat map's own key format. */
  date: string;
  dictations: number;
  words: number;
  /** Summed over the records of that day that carried a clock. */
  seconds: number;
  /** How many of that day's records carried one at all. */
  timed: number;
  longestSeconds: number;
}

/** The heat map's key for a moment, in local time. Local rather than UTC
 *  because a calendar of your days is a calendar of YOUR days: a dictation at
 *  half past midnight belongs to the date the clock on the wall showed. */
export function dayKey(at: number | Date): string {
  const date = at instanceof Date ? at : new Date(at);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function startOfDay(at: number | Date): Date {
  const date = at instanceof Date ? new Date(at.getTime()) : new Date(at);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Which of the five steps a day is lit at — 0 unlit, 4 brightest.
 *
 * A count at or below zero is unlit, and that is the same refusal the counter
 * makes: nothing is not a reading of none.
 */
export function activityStep(dictations: number): number {
  if (!Number.isFinite(dictations) || dictations <= 0) return 0;
  let step = 0;
  for (const threshold of ACTIVITY_STEPS) {
    if (dictations >= threshold) step += 1;
  }
  return step;
}

/* ════════════════════════════════════════════════════════════════════════════
   THE ALL-TIME READINGS, WHICH DO NOT COME FROM HISTORY.

   Everything above reads the index, and the index is pruned on every read by
   age. That is fine for a rate over recent records and fatal for anything
   lifetime-scoped: a total summed from a swept list grows and then runs
   backwards.

   `core::activity_ledger` is the record that does not forget — one row per day,
   counts only, never text. These derivations read it, and they are separate
   functions rather than an argument to the ones above because the two sources
   answer different questions and mixing them would be the quiet way to double
   a day.
   ═══════════════════════════════════════════════════════════════════════════ */

/** One day in the ledger, as the runtime serialises it.
 *
 *  THE FIELDS COME IN GROUPS AND THE GROUPS MAY NOT BE CROSSED. `words` and
 *  `recorded_seconds` describe what was delivered over an open microphone;
 *  `spoken_words` and `speech_seconds` describe what was said while somebody was
 *  actually speaking; the three `saved_*` fields are the credited runs and
 *  nothing else. Dividing one group's numerator by another's denominator is the
 *  plausible wrong number these separate fields exist to make impossible. */
export interface LedgerDay {
  dictations: number;
  /** Words that reached the cursor — the transformed text. */
  words: number;
  /** Words the recogniser heard, before any mode transform (ADR 0177). */
  spoken_words: number;
  /** The open microphone, thinking pauses included. */
  recorded_seconds: number;
  /** The same window with the pauses taken out (ADR 0177). */
  speech_seconds: number;
  /** Runs that carried the capture clock. */
  timed: number;
  /** Runs that carried the speech clock, which is the newer of the two. */
  voiced: number;
  /** Runs whose output may be credited against typing (ADR 0178). */
  saved_runs: number;
  /** Delivered words of exactly those runs. */
  saved_words: number;
  /** Recorded seconds of exactly those runs. */
  saved_seconds: number;
  longest_seconds: number;
  /** How many of the period's dictations carried a turnaround clock, and what
   *  they cost in total (ADR 0243). Two numbers, so the period has an exact
   *  mean; the shape below gives it a median. Absent on a period that timed
   *  none — the runtime writes neither field at zero. */
  turnaround_runs?: number;
  turnaround_ms_sum?: number;
  /** The period's wait distribution on the quarter-octave axis —
   *  `TURNAROUND_LOG_BASE_MS × 2^(i/4)`, forty buckets and an overflow. */
  turnaround_log?: number[];
  /** How many of the period's dictations came back in each language.
   *
   *  THE ONLY LANGUAGE COUNTER THERE IS, since ADR 0244 deleted the lifetime
   *  map beside it. Two counters over one fact drifted by 67 runs and put an
   *  arithmetic on the screen that did not add up. */
  languages?: Record<string, number>;
  /** Dictations whose language was asked for and came back empty.
   *
   *  TOGETHER WITH `languages` THIS ACCOUNTS FOR EVERY DICTATION THE PERIOD
   *  COUNTED (ADR 0244): the runtime increments exactly one of the two on every
   *  counted run, so their sum is the population a language was asked of, which
   *  is what the screen states its share against. */
  language_refused?: number;
}

/** One dictation's log-histogram axis, and it has to match the runtime's
 *  `TURNAROUND_LOG_BASE_MS` and `TURNAROUND_LOG_PER_OCTAVE` or every reading off
 *  it is a plausible wrong number (the `rate_bucket_wpm` lesson, ADR 0243). */
export const TURNAROUND_LOG_BASE_MS = 25;
export const TURNAROUND_LOG_PER_OCTAVE = 4;

/** The lower edge of a quarter-octave bucket, in milliseconds. */
export function turnaroundLogEdge(index: number): number {
  return TURNAROUND_LOG_BASE_MS * Math.pow(2, index / TURNAROUND_LOG_PER_OCTAVE);
}


/** One recogniser's own turnaround distribution (ADR 0240).
 *
 *  The pair is stored rather than parsed back out of the key: a model id may
 *  contain a slash, so splitting one would be right on this machine and wrong
 *  on somebody else's. */
export interface LedgerCause {
  provider: string;
  model: string;
  /** Counted at `TURNAROUND_BUCKET_MS`, the same axis as `turnaround_buckets`. */
  buckets?: number[];
  /** The recogniser's OWN share of those same waits — the audio export plus the
   *  provider round trip, ending the moment there is text to transform
   *  (ADR 0247). What `buckets` has left over belongs to the mode.
   *
   *  ABSENT ON EVERY RUN COUNTED BEFORE THE SPLIT WAS MEASURED, and no rebuild
   *  can fill it: a history record kept one duration and never kept two. The
   *  surface draws no figure where this is empty rather than dividing by a
   *  number it does not have. */
  heard_buckets?: number[];
}

export interface ActivityLedger {
  /** `YYYY-MM-DD` of the first row ever written. NOT the install date — it is
   *  the first day somebody dictated, which on a machine installed in March and
   *  first used in August is five months late. */
  started_on: string | null;
  /** `YYYY-MM-DD` of the day this reader first installed WordScript (ADR 0190).
   *
   *  `null` IS A REAL ANSWER AND NOT A GAP. On an installation that predates the
   *  field there may be nothing honest to put here, and a fabricated date is a
   *  claim the reader can check and find wrong. A missing marker costs nothing;
   *  a wrong one costs the display its credibility. */
  installed_on?: string | null;
  /** Keyed `YYYY-MM-DD`. */
  days: Record<string, LedgerDay>;
  /** One row per month, keyed `YYYY-MM`, and never pruned (ADR 0243).
   *
   *  THE TIERS ARE DISJOINT: a day is in `days` or, once it ages out, in its
   *  month here — never in both. So a month's real figures are this row PLUS
   *  whatever days of it are still live, which is what `monthTotals` is for and
   *  why no caller should read this map directly. */
  months?: Record<string, LedgerDay>;
  /** The turnaround again, cut by the MODE that ran rather than by the
   *  recogniser that answered (ADR 0243), on the same axis as
   *  `turnaround_buckets`. Two one-dimensional cuts of one total, never a
   *  cross-tab. */
  mode_causes?: Record<string, number[]>;
  /** The TRANSFORM's own share of those same waits, keyed the same way
   *  (ADR 0247).
   *
   *  THE ONE READING THE OTHER TWO MAPS COULD NEVER GIVE. `turnaround_causes`
   *  and `mode_causes` both hold the end-to-end wait, so a model row and a mode
   *  row drew one number twice under two headings that each promised something
   *  narrower. This is what a mode actually costs: the interval from the
   *  recogniser answering to the text being final. */
  mode_transform_causes?: Record<string, number[]>;
  /** The first day each accumulator was written, keyed by its row field
   *  (ADR 0243). A series may not draw a period beginning before its field's
   *  stamp: a zero there is the field not having existed, which is a different
   *  claim from nothing having happened. */
  measured_from?: Record<string, string>;
  /** How many runs landed in each one-wpm bucket, all time. The distribution
   *  behind the median — the SPEAKING rate since schema 2. */
  rate_buckets?: number[];
  /** How many runs landed in each twenty-five-millisecond bucket, all time. */
  turnaround_buckets?: number[];
  /** The same distribution split by what produced it, keyed `provider/model`
   *  (ADR 0240). The rows sum to `turnaround_buckets` for every run counted
   *  since both existed; a ledger seeded after the fact can start a couple of
   *  runs short, because it was filled from history and history is shallower. */
  turnaround_causes?: Record<string, LedgerCause>;
  /** How many dictations came back in each language, keyed by ISO 639-1
   *  (ADR 0180). Measured on the delivered text, never read off the setting. */
  languages?: Record<string, number>;
  /** When the figures were last cleared on purpose. A reset ledger never seeds
   *  itself back from history. */
  reset_at_ms?: number | null;
}

/** The ledger's `YYYY-MM-DD` as the heat map's `YYYY/M/D`.
 *
 *  Two key formats exist because the vendored heat map parses its own and the
 *  ledger is a file a person may open, where a padded ISO date sorts correctly
 *  and `2026/8/6` does not. The conversion lives here, once. */
export function ledgerKeyToDayKey(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return key;
  return `${year}/${month}/${day}`;
}

/** The calendar's buckets, from the ledger rather than from history. */
export function ledgerBuckets(ledger: ActivityLedger | null): Map<string, ActivityDay> {
  const days = new Map<string, ActivityDay>();
  if (!ledger) return days;

  for (const [key, row] of Object.entries(ledger.days)) {
    if (!row || row.dictations <= 0) continue;
    const date = ledgerKeyToDayKey(key);
    days.set(date, {
      date,
      dictations: row.dictations,
      words: row.words,
      seconds: row.recorded_seconds,
      timed: row.timed,
      longestSeconds: row.longest_seconds,
    });
  }

  return days;
}

/**
 * THE YEARS THE CALENDAR MAY OFFER, NEWEST FIRST (ADR 0183).
 *
 * DERIVED FROM THE DAY ROWS AND NOT FROM `started_on`, and the difference is the
 * whole point. The ledger keeps `LEDGER_DAY_ROWS` day rows and folds the rest
 * into their months (ADR 0176, ADR 0243): the figures survive, the SHAPE
 * survives at month resolution, and the individual DAYS do not. A year offered
 * on the strength of an install date would therefore draw as a grid of unlit
 * circles — which asserts *you dictated on none of these days* about days the
 * record can no longer speak for at all, and that is the one claim this display
 * is not allowed to make.
 *
 * **AND THE MONTH TIER IS NOT A SOURCE HERE.** A month row can say a year had
 * 400 dictations and cannot say which days they fell on, so offering that year
 * to a per-day grid would put the same unlit-circle claim back one tier up. The
 * month grain answers that year on the metric views instead.
 *
 * A year with rows is a year with something to draw. A year with none is absent,
 * whether that is because it was pruned or because it never happened; the line
 * under the grid names the install date, which is where the difference shows.
 */
export function ledgerYears(ledger: ActivityLedger | null): number[] {
  if (!ledger) return [];
  const years = new Set<number>();
  for (const [key, row] of Object.entries(ledger.days)) {
    if (!row || row.dictations <= 0) continue;
    const year = Number(key.slice(0, 4));
    if (Number.isFinite(year) && year > 0) years.add(year);
  }
  return [...years].sort((left, right) => right - left);
}

/* ════════════════════════════════════════════════════════════════════════════
   MARKERS — A DAY WITH A NAME RATHER THAN A COUNT (ADR 0189).

   The calendar had exactly one kind of day until now: a day with a number
   behind it, painted somewhere on a five-step ramp. A marker is the other kind
   — a day that matters because of what happened to the PRODUCT rather than
   because of how much was dictated on it.

   THE ONE RULE THAT GOVERNS ALL OF THIS: A MARKER NEVER JOINS THE RAMP. It
   carries no count, so painting it as a lit cell would be a figure the runtime
   never produced — which is the invented reading ADR 0161 forbids, on the one
   display whose whole argument is that an unlit circle asserts something. It
   gets its own colour, its own legend entry and its own tooltip line, and the
   day's own step is decided by the day's own dictations and by nothing else.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The day WordScript was published on GitHub — the product's own beginning,
 *  and the same date on every machine that will ever run it.
 *
 *  HARDCODED, DELIBERATELY. It is a fact about the project rather than about
 *  this installation, so there is nothing for the runtime to measure and no
 *  file for it to come out of. */
export const PUBLICATION_DAY = "2026-02-23";
export const PUBLICATION_LABEL = "WordScript Initiation";

/** The name the install marker carries.
 *
 *  IT SAYS *WORDSCRIPT* AND NOT *THIS MACHINE*, and that word is load-bearing
 *  (ADR 0190). The ledger merges across machines by earliest-wins, so importing
 *  an archive from an older machine moves this date back — which is correct for
 *  "when you first installed WordScript" and wrong for "when this machine got
 *  it". The merge rule picked the meaning; the label has to use the same one. */
export const INSTALL_LABEL = "WordScript installed";

/** A day the calendar names. */
export interface ActivityMarker {
  /** `YYYY/M/D`, the heat map's own key. */
  date: string;
  label: string;
}

/**
 * WHERE A NAMED DAY COMES FROM — a list, since ADR 0243, and it was two
 * constants and a field until a third one was asked about.
 *
 * ADDING ONE IS A ROW HERE and nothing else: the map below fills itself from
 * this, the legend counts what it produced, and the hover carries whatever the
 * row is called. The open question this closes was *what happens when a third
 * marker arrives* — a release, an anniversary, a day the reader names
 * themselves — and the answer is that the shape stops being the obstacle.
 *
 * `of` reads the ledger rather than taking a date, because a marker either
 * belongs to the PRODUCT and is the same on every machine, or belongs to THIS
 * installation and has to be looked up. Both kinds live in one list so that the
 * legend and the calendar cannot disagree about how many there are.
 */
export interface MarkerSource {
  /** Stable, so a later session can find every use of one. */
  kind: string;
  label: string;
  of: (ledger: ActivityLedger | null) => string | null | undefined;
}

export const MARKER_SOURCES: MarkerSource[] = [
  {
    kind: "publication",
    label: PUBLICATION_LABEL,
    /* HARDCODED, DELIBERATELY — a fact about the project rather than about this
       installation, so there is nothing for the runtime to measure. */
    of: () => PUBLICATION_DAY,
  },
  {
    kind: "install",
    label: INSTALL_LABEL,
    of: (ledger) => ledger?.installed_on ?? null,
  },
];

/**
 * THE DAYS THIS CALENDAR NAMES, keyed the way the cells are.
 *
 * Two of them at most: the publication, which every installation shares, and
 * the day this reader installed the product, which most have and some cannot.
 * An installation whose ledger carries no `installed_on` draws one marker
 * instead of two — see that field's own note on why a fabricated date is worse
 * than a missing one.
 *
 * The two collapse into one entry when they fall on the same day, because a
 * reader who installed WordScript the day it was published has one anniversary
 * and not two, and two circles cannot share a cell.
 */
export function activityMarkers(ledger: ActivityLedger | null): Map<string, ActivityMarker> {
  const markers = new Map<string, ActivityMarker>();
  const add = (iso: string | null | undefined, label: string) => {
    /* A DATE THAT WILL NOT PARSE NAMES NO DAY. `ledgerKeyToDayKey` hands back
       what it was given when it cannot read it, so an unparsed string would
       become a marker keyed on nonsense — present in the legend, attached to no
       cell, and impossible to find. */
    const [year, month, day] = (iso ?? "").split("-").map(Number);
    if (!year || !month || !day) return;
    const date = ledgerKeyToDayKey(iso!);
    const standing = markers.get(date);
    markers.set(date, {
      date,
      label: standing ? `${standing.label} · ${label}` : label,
    });
  };

  for (const source of MARKER_SOURCES) add(source.of(ledger), source.label);
  return markers;
}

/** How many KINDS of named day this record actually produced (ADR 0243).
 *
 *  THE LEGEND'S ONE WORD IS ENOUGH FOR ONE KIND AND NOT FOR THREE. While every
 *  marker on the grid means the same sort of thing, naming the sort is the whole
 *  legend; past that, the word has to become the count and the names move to the
 *  hover, which is where they already are. */
export function markerKinds(ledger: ActivityLedger | null): number {
  return MARKER_SOURCES.filter((source) => {
    const stamp = source.of(ledger);
    if (!stamp) return false;
    const [year, month, day] = stamp.split("-").map(Number);
    return Boolean(year && month && day);
  }).length;
}

/** The years a marker falls in, so the picker can offer one the ledger has no
 *  day rows for (ADR 0189). A 2026 publication date is otherwise unreachable on
 *  a machine installed in 2027 — the marker exists, the year does not, and the
 *  calendar can never be pointed at it. */
export function markerYears(markers: Map<string, ActivityMarker>): number[] {
  const years = new Set<number>();
  for (const key of markers.keys()) {
    const year = Number(key.split("/")[0]);
    if (Number.isFinite(year) && year > 0) years.add(year);
  }
  return [...years].sort((left, right) => right - left);
}

/** One word a minute per bucket, matching `RATE_BUCKET_WPM` in the runtime. The
 *  two have to agree or the median is read off the wrong axis. */
export const RATE_BUCKET_WPM = 1;

/** Twenty-five milliseconds per bucket, matching `TURNAROUND_BUCKET_MS` in the
 *  runtime. The two have to agree or the median is read off the wrong axis —
 *  which is not hypothetical: a histogram written at one width and read at
 *  another reported 17 where the truth was 88. */
export const TURNAROUND_BUCKET_MS = 25;

/** The middle of a sorted histogram, at its bucket's lower edge. */
function medianOf(buckets: number[] | undefined, width: number): number | null {
  const counts = buckets ?? [];
  const runs = counts.reduce((sum, count) => sum + count, 0);
  if (runs === 0) return null;

  const midpoint = Math.floor(runs / 2);
  let seen = 0;
  for (let index = 0; index < counts.length; index += 1) {
    seen += counts[index];
    if (seen > midpoint) return index * width;
  }
  return null;
}

/**
 * HOW LONG YOU WAIT — median milliseconds from the audio arriving to the text
 * existing.
 *
 * THE ONE LATENCY THIS PRODUCT CAN HONESTLY REPORT. *Time until the text is with
 * you* ends at the reader, and with clipboard delivery nobody knows when that
 * was; both ends of THIS interval are inside the runtime and it is the same
 * measurement whichever way the text is delivered.
 *
 * IT IS THE ONLY TILE THAT ANSWERS TO A SETTING. Words per minute and time saved
 * are facts about the speaker; this moves the moment the model, the lane or the
 * profile changes, which is what makes it possible to tell whether a change
 * helped rather than remembering how it felt last week.
 *
 * A median, for the reason the rate is one: a cold start behind a model that had
 * to load is not what the next dictation will cost. Measured over 84 real
 * sessions the spread was 810 ms to 7,250 ms around a median of 1,210.
 */
export function ledgerMedianTurnaround(ledger: ActivityLedger | null): number | null {
  if (!ledger) return null;
  return medianOf(ledger.turnaround_buckets, TURNAROUND_BUCKET_MS);
}

/**
 * THE MIDDLE DICTATION'S SPEAKING RATE, ALL TIME — a median, over spoken words,
 * with the thinking pauses out of the denominator.
 *
 * THREE THINGS HAD TO BE RIGHT AND ONLY ONE OF THEM WAS.
 *
 *   - **A median rather than an aggregate or a mean.** Total words over total
 *     seconds is duration-weighted and is dragged DOWN by long dictations; a
 *     mean is dragged UP by short hallucinated ones — one two-second capture
 *     reported 273 wpm because the recogniser invented ten words for it. On real
 *     records the three read 82.7, 95.3 and 87.6. This part was already right.
 *   - **Spoken words and not delivered ones** (ADR 0177). The old numerator was
 *     the transformed text, so Cleanup's removed filler cost a few percent — and
 *     Prompt Enhance, where a model writes two hundred words from fifteen spoken
 *     ones, would have filled the histogram with rates in the hundreds. On fifty
 *     real records the median moved from 86.8 to 90.3 on this alone.
 *   - **Speech seconds and not the open microphone** (ADR 0177). The pause while
 *     you work out the next sentence used to sit in the denominator, which made
 *     this throughput rather than articulation. It is now measured in the audio
 *     callback and subtracted, so the tile answers *how fast do I speak* — the
 *     only reading of it anybody can act on.
 *
 * A median needs the distribution, which is why the runtime keeps a fixed
 * four-hundred-bucket histogram rather than a running total: a list of every
 * run's rate would make the ledger grow with use, which is the one thing it must
 * not do. One bucket per word a minute, so the median is exact at the resolution
 * the tile draws.
 *
 * `timed` here counts the runs that carried the SPEECH clock, because those are
 * the ones in the histogram. Every record written before ADR 0177 has none, so
 * the figure is dark until the next dictation rather than wrong from an older
 * one.
 */
export function ledgerMedianWpm(ledger: ActivityLedger | null): ActivityReading | null {
  if (!ledger) return null;

  const totals = ledgerTotals(ledger);
  /* The bucket's LOWER edge: at one wpm per bucket it never reports a rate
     higher than any run actually reached. */
  const value = medianOf(ledger.rate_buckets, RATE_BUCKET_WPM);
  return value === null
    ? null
    : { value, timed: totals.voiced, total: totals.dictations };
}

/**
 * WHAT THE LAST FOUR WEEKS GAVE BACK, against the reader's own typing baseline.
 *
 * The one figure on the row that is NOT all-time, and deliberately: a lifetime
 * "time saved" stops being something a reader can hold. The window is the
 * owner's call and the calendar's own unit.
 *
 * IT DIVIDES ONE SET OF RUNS AND NOT TWO (ADR 0178). The first build summed a
 * day's words — every one of them — against the seconds of only those runs that
 * carried a clock, so a day holding one untimed record credited its words
 * against nothing. The runtime now writes `saved_words` and `saved_seconds` as a
 * pair, from the same runs or from neither.
 *
 * AND IT COUNTS ONLY WHAT SOMEBODY WOULD HAVE TYPED. Agent and Prompt Enhance
 * generate prose from a sentence of instruction; crediting their output against
 * a typing speed invents hours out of a model's verbosity. Those runs contribute
 * their words to the day and nothing to this figure.
 *
 * THE COST SIDE IS THE OPEN MICROPHONE and not the speech clock, which looks
 * inconsistent beside the rate above and is not: the thinking pause was your
 * time too. You spent it. The rate asks how fast you speak; this asks what the
 * dictation cost, and those are different questions about the same minute.
 */
export function ledgerTimeSaved(
  ledger: ActivityLedger | null,
  now = Date.now(),
  baselineWpm = TYPING_BASELINE_WPM,
): ActivityReading | null {
  if (!ledger) return null;

  /* A divisor, so it is guarded here as well as in the runtime: a config a
     person hand-edited must not turn a tile into an infinity. */
  const baseline = Number.isFinite(baselineWpm) && baselineWpm > 0 ? baselineWpm : TYPING_BASELINE_WPM;
  const since = startOfDay(now).getTime() - (SAVED_WINDOW_DAYS - 1) * DAY_MS;
  let words = 0;
  let seconds = 0;
  let credited = 0;
  let total = 0;

  for (const [key, row] of Object.entries(ledger.days)) {
    if (!row) continue;
    const [year, month, day] = key.split("-").map(Number);
    if (!year || !month || !day) continue;
    if (new Date(year, month - 1, day).getTime() < since) continue;

    total += row.dictations ?? 0;
    words += row.saved_words ?? 0;
    seconds += row.saved_seconds ?? 0;
    credited += row.saved_runs ?? 0;
  }

  if (credited === 0) return null;
  return {
    value: Math.max(0, words / baseline - seconds / 60),
    timed: credited,
    total,
  };
}

/** A `YYYY-MM-DD` as local midnight, or `null` where it will not parse. */
export function ledgerDayMs(iso: string | null | undefined): number | null {
  const [year, month, day] = (iso ?? "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day).getTime();
}

/**
 * THE FIRST DAY THIS RECORD KNOWS ABOUT — `started_on`, or the earliest day row
 * where the file predates that field.
 *
 * NOT `installed_on`, and the difference is the whole reason this exists. The
 * install marker is what the reader installed WordScript on; on the machine this
 * was written against it says April while the ledger's first row is 16 August,
 * because the ledger itself is younger than the installation. A window measured
 * against the install date would therefore claim four weeks of record where
 * there are three days of it.
 */
export function ledgerFirstDay(ledger: ActivityLedger | null): number | null {
  const started = ledgerDayMs(ledger?.started_on);
  if (started !== null) return started;

  let earliest: number | null = null;
  for (const [key, row] of Object.entries(ledger?.days ?? {})) {
    if (!row || row.dictations <= 0) continue;
    const at = ledgerDayMs(key);
    if (at === null) continue;
    if (earliest === null || at < earliest) earliest = at;
  }
  return earliest;
}

/**
 * THE FIRST DAY THE ROWS THEMSELVES CAN SPEAK FOR.
 *
 * A day past the horizon is folded into its month, so the DAY tier reaches back
 * exactly as far as its oldest row and no further. Anything that draws a day or
 * a week has to start here, or it draws an empty bucket over a period the day
 * rows no longer hold — the same false claim ADR 0172 keeps the calendar's
 * unlit cells away from. A month or a year asks `ledgerMonthsSpeakFrom`, which
 * reaches further.
 *
 * IT USED TO CONSULT A SECOND STAMP. `retired_through` marked the edge of an
 * opaque blob that no longer exists (ADR 0244), and with the blob gone the
 * oldest row is the whole answer.
 */
export function ledgerSpeaksFrom(ledger: ActivityLedger | null): number | null {
  /* THE OLDEST DAY ROW, AND EXPLICITLY NOT `ledgerFirstDay`. That one prefers
     `started_on`, which is where the RECORD begins — on a record whose old days
     have been folded into months it sits a year before the day tier, and a day
     series built on it would draw a year of empty buckets over periods the day
     rows cannot speak for. The first version of this after ADR 0244 did exactly
     that, and the suite caught it. */
  let earliest: number | null = null;
  for (const [key, row] of Object.entries(ledger?.days ?? {})) {
    if (!row || row.dictations <= 0) continue;
    const at = ledgerDayMs(key);
    if (at === null) continue;
    if (earliest === null || at < earliest) earliest = at;
  }
  return earliest;
}

/**
 * THE FIRST MONTH THE RECORD CAN SPEAK FOR, WHICH REACHES MUCH FURTHER BACK
 * THAN THE FIRST DAY (ADR 0243).
 *
 * THIS IS THE FUNCTION THAT MAKES A METRIC INFINITE, and its absence is what
 * made every chart on Home 2.2 years deep however long the product had been
 * running: a retired day used to lose its shape, so `ledgerSpeaksFrom` was the
 * horizon for every grain, the *Months* tab could never hold more than 26
 * buckets and the *Years* tab could never hold more than three.
 *
 * A month row keeps its place in time and is never pruned, so a month grain
 * starts at the oldest row of either tier, with no exception to state. There
 * used to be one — the single month split between the opaque blob and the tier
 * — and ADR 0244 deleted the blob, so nothing in this ledger is partial any
 * more.
 */
export function ledgerMonthsSpeakFrom(ledger: ActivityLedger | null): number | null {
  let earliest: number | null = null;
  const consider = (key: string) => {
    const [year, month] = key.split("-").map(Number);
    if (!year || !month) return;
    const at = new Date(year, month - 1, 1).getTime();
    if (earliest === null || at < earliest) earliest = at;
  };
  for (const [key, row] of Object.entries(ledger?.months ?? {})) {
    if (row && row.dictations > 0) consider(key);
  }
  for (const [key, row] of Object.entries(ledger?.days ?? {})) {
    if (row && row.dictations > 0) consider(key.slice(0, 7));
  }

  return earliest;
}

/**
 * HOW MANY DAYS OF THE FOUR-WEEK WINDOW THE RECORD ACTUALLY REACHES OVER
 * (ADR 0233).
 *
 * THE WINDOW WAS ALWAYS TRUE AND THE LABEL WAS ALWAYS `last 4 weeks`, and on a
 * three-day-old record those are two different claims. The figure was right —
 * 203 minutes really were saved in the last four weeks — but a reader takes it
 * for a four-week rate and it is a three-day one. Naming the span the record can
 * speak for costs nothing and is the whole fix; the window itself does not move.
 *
 * A ROLLING WINDOW AND NOT A TUMBLING ONE, which was the alternative and is
 * worse: a counter that restarts every twenty-eight days falls to nothing on the
 * boundary, and decision 7 of this track is that no tile may sit at zero for
 * long. It also makes two readings a month apart incomparable, which is the one
 * thing a figure like this is for.
 */
export function savedWindowSpan(
  ledger: ActivityLedger | null,
  now = Date.now(),
): number | null {
  const first = ledgerFirstDay(ledger);
  if (first === null) return null;
  /* ROUNDED RATHER THAN FLOORED, over local midnights: a span across a
     daylight-saving boundary is 24 h ± 1 h long, and a floor drops the last day
     twice a year. */
  const days = Math.round((startOfDay(now).getTime() - first) / DAY_MS) + 1;
  return Math.min(SAVED_WINDOW_DAYS, Math.max(1, days));
}

/**
 * EVERY FIGURE THE LEDGER HOLDS, INCLUDING THE DAYS THAT HAVE AGED OUT OF IT.
 *
 * `months` is what the runtime folds a day row into on its way out of the file
 * (ADR 0176, ADR 0243), and reading the days without it is how a lifetime total
 * starts falling after two years and two months — the exact failure the ledger
 * exists to prevent, reintroduced by the code that keeps the file small.
 */
export function ledgerTotals(ledger: ActivityLedger | null): LedgerDay {
  const total = emptyDay();
  if (!ledger) return total;

  /* TWO TIERS AND THEY ARE DISJOINT (ADR 0243, ADR 0244): the month rows a day
     is folded into when it ages out, and the live days. A day is in exactly one
     of them, so this adds rather than picks — and leaving the months out is how
     a lifetime total would start falling again, one tier further along than the
     failure ADR 0176 fixed. */
  for (const row of Object.values(ledger.months ?? {})) absorbDay(total, row);
  for (const row of Object.values(ledger.days)) absorbDay(total, row);
  return total;
}

/** A row with every accumulator at nothing. */
export function emptyDay(): LedgerDay {
  return {
    dictations: 0,
    words: 0,
    spoken_words: 0,
    recorded_seconds: 0,
    speech_seconds: 0,
    timed: 0,
    voiced: 0,
    saved_runs: 0,
    saved_words: 0,
    saved_seconds: 0,
    longest_seconds: 0,
    turnaround_runs: 0,
    turnaround_ms_sum: 0,
    turnaround_log: [],
    languages: {},
    language_refused: 0,
  };
}

/**
 * FOLD ONE ROW INTO ANOTHER — the merge rule, in one place, on this side of the
 * bridge (ADR 0243).
 *
 * It is the same arithmetic `LedgerDay::absorb` performs in the runtime, and it
 * has to stay the same arithmetic: a day becoming a week here and a day becoming
 * a month there are the same operation, and two implementations of it are two
 * definitions of what a period's figures are. Sums add, the maximum takes the
 * larger, histograms add bucket by bucket, tallies add key by key.
 */
export function absorbDay(total: LedgerDay, row: LedgerDay | null | undefined): LedgerDay {
  if (!row) return total;
  total.dictations += row.dictations ?? 0;
  total.words += row.words ?? 0;
  total.spoken_words += row.spoken_words ?? 0;
  total.recorded_seconds += row.recorded_seconds ?? 0;
  total.speech_seconds += row.speech_seconds ?? 0;
  total.timed += row.timed ?? 0;
  total.voiced += row.voiced ?? 0;
  total.saved_runs += row.saved_runs ?? 0;
  total.saved_words += row.saved_words ?? 0;
  total.saved_seconds += row.saved_seconds ?? 0;
  total.longest_seconds = Math.max(total.longest_seconds, row.longest_seconds ?? 0);
  total.turnaround_runs = (total.turnaround_runs ?? 0) + (row.turnaround_runs ?? 0);
  total.turnaround_ms_sum = (total.turnaround_ms_sum ?? 0) + (row.turnaround_ms_sum ?? 0);
  if (row.turnaround_log?.length) {
    const own = total.turnaround_log ?? [];
    for (let index = 0; index < row.turnaround_log.length; index += 1) {
      own[index] = (own[index] ?? 0) + row.turnaround_log[index];
    }
    total.turnaround_log = own;
  }
  if (row.languages) {
    const own = total.languages ?? {};
    for (const [code, count] of Object.entries(row.languages)) {
      own[code] = (own[code] ?? 0) + count;
    }
    total.languages = own;
  }
  total.language_refused = (total.language_refused ?? 0) + (row.language_refused ?? 0);
  return total;
}

/**
 * ONE CALENDAR MONTH'S FIGURES, WHICHEVER TIER THEY ARE SITTING IN (ADR 0243).
 *
 * THE ONLY PLACE THE TIER SUM IS WRITTEN on this side, and the reason it is a
 * function rather than a line at three call sites: a caller that read `months`
 * alone would report the CURRENT month as empty until the day it ages out —
 * which is the one month the reader is most likely to be looking at.
 */
export function monthTotals(ledger: ActivityLedger | null, month: string): LedgerDay {
  const total = emptyDay();
  if (!ledger) return total;
  absorbDay(total, ledger.months?.[month]);
  for (const [key, row] of Object.entries(ledger.days)) {
    if (key.slice(0, 7) === month) absorbDay(total, row);
  }
  return total;
}

/** The period's mean wait, in milliseconds, or `null` where it timed nothing.
 *
 *  A MEAN HERE AND A MEDIAN ON THE TILE, deliberately: the tile answers *what
 *  does a dictation usually cost* over a distribution the ledger keeps whole,
 *  and a period answers *did this week move*, where the exact sum of what was
 *  actually waited is the more honest number and needs no binning at all. */
export function dayMeanTurnaround(day: LedgerDay | null | undefined): number | null {
  if (!day?.turnaround_runs) return null;
  return (day.turnaround_ms_sum ?? 0) / day.turnaround_runs;
}

/** The period's middle wait, read off the log axis at the bucket's lower edge.
 *  `null` where the period timed nothing — which is not a zero. */
export function dayMedianTurnaround(day: LedgerDay | null | undefined): number | null {
  const buckets = day?.turnaround_log;
  if (!buckets?.length) return null;
  const total = buckets.reduce((sum, count) => sum + count, 0);
  if (total === 0) return null;
  const midpoint = Math.floor(total / 2);
  let seen = 0;
  for (let index = 0; index < buckets.length; index += 1) {
    seen += buckets[index];
    if (seen > midpoint) return turnaroundLogEdge(index);
  }
  return null;
}

/**
 * THE SHARE OF THE OPEN MICROPHONE THAT WAS THINKING RATHER THAN SPEAKING.
 *
 * What the rate's tooltip states, and the reason the rate moved when ADR 0177
 * landed. `null` where nothing carried the speech clock — which is every record
 * written before it existed, and is a refusal rather than a zero.
 */
export function ledgerPauseShare(ledger: ActivityLedger | null): number | null {
  const totals = ledgerTotals(ledger);
  if (totals.voiced === 0 || totals.speech_seconds <= 0) return null;
  /* Against the recorded seconds OF THE VOICED RUNS, which is not a field —
     `recorded_seconds` covers the timed runs, a superset. Where every run is
     both, the two agree; where they do not, this understates the share rather
     than inventing one, and understating is the safe direction for a figure
     that exists to say "your rate used to be dragged down by this much". */
  if (totals.recorded_seconds <= totals.speech_seconds) return 0;
  return (totals.recorded_seconds - totals.speech_seconds) / totals.recorded_seconds;
}

/**
 * THE LANGUAGES THIS INSTALLATION HAS DICTATED IN, most-used first (ADR 0180).
 *
 * Measured on the delivered text rather than read off `entry.language`, which is
 * the CONFIGURED language and would count how often somebody changed a dropdown.
 * A run whose text was too short to be sure of is in no bucket at all; it is in
 * `language_refused`, and the two together are every dictation the record
 * counted.
 *
 * READ OFF THE TIERS AND NOT OFF A LIFETIME MAP (ADR 0244). There was a second
 * counter beside them, live since ADR 0180, and two copies of one fact are what
 * ADR 0123 forbids: they drifted by 67 runs on the only machine that had both,
 * and the facts list underneath this chart summed to more than the dictations
 * it was measured over.
 */
export function ledgerLanguages(
  ledger: ActivityLedger | null,
): { code: string; count: number }[] {
  const languages = ledgerTotals(ledger).languages;
  if (!languages) return [];
  return Object.entries(languages)
    .filter(([code, count]) => code.trim().length > 0 && count > 0)
    .map(([code, count]) => ({ code, count }))
    .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code));
}

/** The English name for a measured language code.
 *
 *  THE DETECTOR REACHES PAST WHAT THIS PRODUCT TRANSLATES BETWEEN — seventy
 *  languages against Translate's eight — so a table of the eight would leave a
 *  Swedish dictation labelled `SV`. `Intl.DisplayNames` already knows every code
 *  either side can produce and is in both engines this runs in, which is why
 *  there is no third language list in this repository.
 *
 *  A code it does not know comes back unchanged, and then the code itself is the
 *  label: naming a language wrongly is worse than showing its code. */
export function languageLabel(code: string): string {
  try {
    const name = new Intl.DisplayNames(["en"], { type: "language" }).of(code);
    if (name && name.toLowerCase() !== code.toLowerCase()) return name;
  } catch {
    /* An invalid tag throws rather than answering. Fall through. */
  }
  return (
    TRANSLATE_LANGUAGES.find((language) => language.code === code)?.label ?? code.toUpperCase()
  );
}

/**
 * HOW MUCH OF THE RECORD THE MOST-USED LANGUAGE IS — a share of the dictations
 * that were MEASURED, never of all of them.
 *
 * The denominator is the only thing to get right here, and it is not
 * `dictations`. A run whose text was too short to be sure of is in no language
 * bucket at all (ADR 0180), so dividing by the day count would report a share
 * that falls whenever somebody dictates a sentence — the language did not
 * change, the measurement simply had nothing to read. Against the measured runs
 * the figure answers the question the tile's own count cannot: of the ones we
 * could name, how many were this one.
 */
export function ledgerTopLanguageShare(
  languages: { code: string; count: number }[],
): number | null {
  if (languages.length === 0) return null;
  const measured = languages.reduce((sum, language) => sum + language.count, 0);
  if (measured <= 0) return null;
  return languages[0].count / measured;
}
