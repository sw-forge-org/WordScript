/**
 * WHAT THE RECORD SAYS ABOUT HOW YOU DICTATE.
 *
 * Every reading here is derived in one place, under test, and carries the count
 * it was computed over — because a rate whose denominator quietly skipped half
 * the runs is a plausible wrong number, and a plausible wrong number is the
 * failure class this repository keeps a whole track for.
 *
 * THE SOURCE IS THE LEDGER AND NOT HISTORY, and that is the load-bearing fact.
 * `history.json` is pruned on every read by age AND by count, so a total summed
 * from it grows, sticks at the limit and then runs BACKWARDS as the oldest
 * records fall off. `core::activity_ledger` keeps one row per day — counts and
 * durations, never text — and does not forget, which is what lets these figures
 * say *all time* at all. The first build of this module read history and could
 * not.
 *
 * `capture_integrity` IS NULL MORE OFTEN THAN IT LOOKS — absent on a retry,
 * which never touched a microphone, and on every record written before the
 * measurement existed. The ledger counts those runs' WORDS but not their
 * SECONDS, so `timed` and `total` differ and every rate says which it used.
 */

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

   Everything above reads `history.json`, and history is pruned on every read by
   age and by count. That is fine for a rate over recent records and fatal for
   anything lifetime-scoped: a total summed from a pruned list grows, sticks at
   the limit, and then runs backwards.

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
  /** Every day that has aged out of `days`, summed. Why a total can promise
   *  never to fall: the row leaves the file and its figures do not. */
  retired?: LedgerDay;
  /** The last day `retired` speaks for. */
  retired_through?: string | null;
  /** Keyed `YYYY-MM-DD`. */
  days: Record<string, LedgerDay>;
  /** How many runs landed in each one-wpm bucket, all time. The distribution
   *  behind the median — the SPEAKING rate since schema 2. */
  rate_buckets?: number[];
  /** How many runs landed in each twenty-five-millisecond bucket, all time. */
  turnaround_buckets?: number[];
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
 * whole point. The ledger keeps 800 day rows and RETIRES the rest into the
 * totals (ADR 0176): the figures survive, the days do not. A year offered on the
 * strength of an install date would therefore draw as a grid of unlit
 * circles — which asserts *you dictated on none of these days* about days the
 * record can no longer speak for at all, and that is the one claim this display
 * is not allowed to make.
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

  add(PUBLICATION_DAY, PUBLICATION_LABEL);
  add(ledger?.installed_on ?? null, INSTALL_LABEL);
  return markers;
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

/**
 * EVERY FIGURE THE LEDGER HOLDS, INCLUDING THE DAYS THAT HAVE AGED OUT OF IT.
 *
 * `retired` is what the runtime adds a day row into on its way out of the file
 * (ADR 0176), and reading the days without it is how a lifetime total starts
 * falling after two years and two months — the exact failure the ledger exists
 * to prevent, reintroduced by the code that keeps the file small.
 */
export function ledgerTotals(ledger: ActivityLedger | null): LedgerDay {
  const total: LedgerDay = {
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
  };
  if (!ledger) return total;

  const rows = [ledger.retired, ...Object.values(ledger.days)];
  for (const row of rows) {
    if (!row) continue;
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
  }
  return total;
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
 * A run whose text was too short to be sure of is in no bucket at all, so the
 * counts sum to less than the dictations and deliberately so.
 */
export function ledgerLanguages(
  ledger: ActivityLedger | null,
): { code: string; count: number }[] {
  const languages = ledger?.languages;
  if (!languages) return [];
  return Object.entries(languages)
    .filter(([code, count]) => code.trim().length > 0 && count > 0)
    .map(([code, count]) => ({ code, count }))
    .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code));
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
