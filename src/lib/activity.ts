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

/** The typing speed `timeSavedMinutes` measures against.
 *
 *  IT IS AN ASSUMPTION AND NOT A MEASUREMENT. Nothing in this product has ever
 *  watched the reader type, and nothing will; 40 words a minute is the ordinary
 *  figure for sustained prose typing. That is exactly why the surface renders
 *  the result with `≈` and names the baseline: a number derived from a guess may
 *  be shown, but it may not be dressed as a reading. */
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
 *  Fixed steps make the colour an absolute claim about a day. */
export const ACTIVITY_STEPS = [1, 3, 6, 11];

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

/** One day in the ledger, as the runtime serialises it. */
export interface LedgerDay {
  dictations: number;
  words: number;
  recorded_seconds: number;
  timed: number;
  longest_seconds: number;
}

export interface ActivityLedger {
  /** `YYYY-MM-DD` of the first row ever written — the closest thing to an
   *  install date this product has. */
  started_on: string | null;
  /** Keyed `YYYY-MM-DD`. */
  days: Record<string, LedgerDay>;
  /** How many runs landed in each one-wpm bucket, all time. The distribution
   *  behind the median. */
  rate_buckets?: number[];
  /** How many runs landed in each twenty-five-millisecond bucket, all time. */
  turnaround_buckets?: number[];
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
 * THE MIDDLE DICTATION'S RATE, ALL TIME — a median and deliberately not a mean.
 *
 * The first build divided total words by total seconds, which is a
 * duration-weighted aggregate. Measured on real records it read 82.7 where the
 * mean of the per-run rates read 95.3 and the median read 87.6, and the reason
 * the three disagree is the reason this is a median now:
 *
 *   - **An aggregate is dragged DOWN by long dictations.** Runs over a minute
 *     carried 81 % of all recorded seconds, and a long dictation is mostly
 *     thinking pauses, so the figure drifts towards the rate of the reader's
 *     slowest sessions rather than their typical one.
 *   - **A mean is dragged UP by short ones.** One two-second capture reported
 *     273 wpm because the recogniser invented ten words for it. That single run
 *     moves a mean of fifty by nearly four words a minute; it moves a median by
 *     nothing at all.
 *
 * A median needs the distribution, which is why the runtime keeps a fixed
 * four-hundred-bucket histogram rather than a running total — a list of every
 * run's rate would make the ledger grow with use, which is the one thing it must
 * not do. One bucket per word a minute, so the median is exact at the resolution
 * the tile draws.
 *
 * IT IS STILL THROUGHPUT AND NOT ARTICULATION. `recorded_seconds` is the open
 * microphone, so the pause while you think is inside every run's rate. The
 * median makes the figure typical; it does not make it a speaking rate.
 */
export function ledgerMedianWpm(ledger: ActivityLedger | null): ActivityReading | null {
  if (!ledger) return null;

  let timed = 0;
  let total = 0;
  for (const row of Object.values(ledger.days)) {
    if (!row) continue;
    total += row.dictations;
    timed += row.timed;
  }

  /* The bucket's LOWER edge: at one wpm per bucket it never reports a rate
     higher than any run actually reached. */
  const value = medianOf(ledger.rate_buckets, RATE_BUCKET_WPM);
  return value === null ? null : { value, timed, total };
}

/**
 * What the last four weeks gave back, against the typing baseline.
 *
 * The one figure on the row that is NOT all-time, and deliberately: a lifetime
 * "time saved" stops being something a reader can hold. The window is the
 * owner's call and the calendar's own unit.
 */
export function ledgerTimeSaved(
  ledger: ActivityLedger | null,
  now = Date.now(),
): ActivityReading | null {
  if (!ledger) return null;

  const since = startOfDay(now).getTime() - (SAVED_WINDOW_DAYS - 1) * DAY_MS;
  let words = 0;
  let seconds = 0;
  let timed = 0;
  let total = 0;

  for (const [key, row] of Object.entries(ledger.days)) {
    if (!row) continue;
    const [year, month, day] = key.split("-").map(Number);
    if (!year || !month || !day) continue;
    if (new Date(year, month - 1, day).getTime() < since) continue;

    total += row.dictations;
    if (row.timed > 0 && row.recorded_seconds > 0) {
      words += row.words;
      seconds += row.recorded_seconds;
      timed += row.timed;
    }
  }

  if (timed === 0) return null;
  return {
    value: Math.max(0, words / TYPING_BASELINE_WPM - seconds / 60),
    timed,
    total,
  };
}
