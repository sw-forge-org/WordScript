/**
 * WHAT A READING LOOKED LIKE OVER TIME, AND WHAT ITS SPREAD IS.
 *
 * The tiles answer *who are you, averaged*; the calendar answers *what did you
 * do, day by day*. This module answers the third question, which is the one the
 * owner asked for and neither of the other two can take: *is it moving, and in
 * which direction*.
 *
 * IT IS A SEPARATE MODULE FROM `activity` BECAUSE IT ANSWERS A DIFFERENT SHAPE
 * OF QUESTION, not because the ledger is a different file — it is the same
 * ledger, read through the same rules. `activity` derives one figure per tile;
 * this derives a row of them, and the bucketing is where a row of figures gets
 * quietly wrong.
 *
 * THE HARD RULE, INHERITED FROM ADR 0172: A BUCKET THE RECORD CANNOT SPEAK FOR
 * IS NOT DRAWN. The ledger retires day rows into a total after 800 of them, so a
 * month older than that has figures and no days; drawing it as an empty column
 * would assert that nothing happened in a month the file simply no longer holds.
 * Every series here starts at `ledgerSpeaksFrom` and not a day earlier.
 *
 * AND AN EMPTY BUCKET IS NOT ALWAYS A ZERO. A week with no dictation in it saved
 * no time — that is a true zero and it is drawn. The same week has no speaking
 * rate at all, and drawing that as zero would claim the reader spoke at nought
 * words a minute. Both come out of the same walk, so every point says which it
 * is.
 */

import {
  ledgerSpeaksFrom,
  ledgerTotals,
  TURNAROUND_BUCKET_MS,
  TYPING_BASELINE_WPM,
  type ActivityLedger,
  type LedgerDay,
} from "./activity";

/** The four grains a series may be read at. Days for *this week*, years for
 *  *this product* — and everything in between, which is what the owner asked
 *  for when the four-week window turned out to be the only span on the screen. */
export type Period = "day" | "week" | "month" | "year";

export const PERIODS: Period[] = ["day", "week", "month", "year"];

/** What the control calls each grain. */
export const PERIOD_LABELS: Record<Period, string> = {
  day: "Days",
  week: "Weeks",
  month: "Months",
  year: "Years",
};

/** How many buckets of each grain a chart draws at most.
 *
 *  The day span is `SAVED_WINDOW_DAYS`, so the time-saved chart at its default
 *  grain draws exactly the window the tile above it reports; the week span is
 *  `ACTIVITY_WEEKS`, so it draws exactly the calendar's half-year. Two numbers
 *  the reader has already seen, rather than two new ones. */
export const PERIOD_SPAN: Record<Period, number> = {
  day: 28,
  week: 26,
  month: 12,
  year: 10,
};

/** How many buckets a grain has to be able to fill before it is offered at all.
 *
 *  THREE, AND IT IS THE CALENDAR'S OWN RULE ONE STEP FURTHER (ADR 0183): a
 *  period the record cannot speak for is not offered. A `Years` tab holding one
 *  bar is a control that teaches the reader nothing and costs them a press to
 *  find out. The tabs appear as the record grows into them, which is the same
 *  way the year picker fills. */
export const PERIOD_FLOOR = 3;

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const LONG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The first moment of the bucket a date falls in.
 *
 *  THE WEEK STARTS ON MONDAY (ADR 0235), the same as the calendar's grid. Two
 *  displays on one screen that disagree about which day a week starts on is a
 *  reader counting columns twice. */
export function periodStart(at: number | Date, period: Period): Date {
  const date = at instanceof Date ? new Date(at.getTime()) : new Date(at);
  date.setHours(0, 0, 0, 0);
  if (period === "week") date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  if (period === "month") date.setDate(1);
  if (period === "year") {
    date.setMonth(0);
    date.setDate(1);
  }
  return date;
}

/** The bucket after this one. Over calendar fields rather than milliseconds, so
 *  a month is a month and a daylight-saving Sunday is still one day. */
function nextPeriod(start: Date, period: Period): Date {
  const next = new Date(start.getTime());
  if (period === "day") next.setDate(next.getDate() + 1);
  if (period === "week") next.setDate(next.getDate() + 7);
  if (period === "month") next.setMonth(next.getMonth() + 1);
  if (period === "year") next.setFullYear(next.getFullYear() + 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

/** The axis label — short, because up to twenty-eight of them share a row. */
function shortLabel(start: Date, period: Period): string {
  if (period === "day") return String(start.getDate());
  if (period === "week") return `${start.getDate()} ${SHORT_MONTHS[start.getMonth()]}`;
  if (period === "month") return SHORT_MONTHS[start.getMonth()];
  return String(start.getFullYear());
}

/** The read-out label — the one line under the chart, where there is room to
 *  say the whole thing. */
function longLabel(start: Date, period: Period): string {
  if (period === "day") {
    return `${SHORT_DAYS[(start.getDay() + 6) % 7]} ${start.getDate()} ${SHORT_MONTHS[start.getMonth()]}`;
  }
  if (period === "week") {
    return `week of ${start.getDate()} ${SHORT_MONTHS[start.getMonth()]}`;
  }
  if (period === "month") return `${LONG_MONTHS[start.getMonth()]} ${start.getFullYear()}`;
  return String(start.getFullYear());
}

/** One column of a chart. */
export interface SeriesPoint {
  key: string;
  /** Under the axis. */
  label: string;
  /** In the read-out, spelled out. */
  full: string;
  value: number;
  /** How many dictations stand behind it — the count that says what the value
   *  is a value OF. */
  runs: number;
  /** The record holds nothing at all for this bucket. For a sum that is a true
   *  zero; for a rate it is the absence of a reading, and the chart draws the
   *  two differently. */
  empty: boolean;
}

/** The day rows of one bucket, summed. */
type Fold = (rows: LedgerDay[]) => { value: number; runs: number; empty: boolean };

function walk(
  ledger: ActivityLedger | null,
  period: Period,
  fold: Fold,
  now: number,
): SeriesPoint[] {
  const from = ledgerSpeaksFrom(ledger);
  if (from === null) return [];

  /* THE ROWS, GROUPED BY THE BUCKET THEY FALL IN. Keyed on the bucket's own
     start so the walk below can look one up without parsing anything twice. */
  const grouped = new Map<number, LedgerDay[]>();
  for (const [key, row] of Object.entries(ledger?.days ?? {})) {
    if (!row) continue;
    const [year, month, day] = key.split("-").map(Number);
    if (!year || !month || !day) continue;
    const start = periodStart(new Date(year, month - 1, day), period).getTime();
    const standing = grouped.get(start);
    if (standing) standing.push(row);
    else grouped.set(start, [row]);
  }

  /* THE SPAN IS CLIPPED TO WHAT THE ROWS REACH OVER, at both ends. The newest
     bucket is the one today falls in — never a later one, which would be a
     column for a week that has not happened. */
  const newest = periodStart(now, period);
  const oldest = periodStart(from, period);

  const starts: Date[] = [];
  for (let at = new Date(newest.getTime()); at.getTime() >= oldest.getTime(); ) {
    starts.unshift(new Date(at.getTime()));
    if (starts.length >= PERIOD_SPAN[period]) break;
    const previous = new Date(at.getTime());
    if (period === "day") previous.setDate(previous.getDate() - 1);
    if (period === "week") previous.setDate(previous.getDate() - 7);
    if (period === "month") previous.setMonth(previous.getMonth() - 1);
    if (period === "year") previous.setFullYear(previous.getFullYear() - 1);
    previous.setHours(0, 0, 0, 0);
    at = previous;
  }

  return starts.map((start) => {
    const rows = grouped.get(start.getTime()) ?? [];
    const reading = fold(rows);
    return {
      key: `${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`,
      label: shortLabel(start, period),
      full: longLabel(start, period),
      ...reading,
    };
  });
}

/** How many buckets of a grain the record could fill — what `offeredPeriods`
 *  measures a grain against. */
export function periodReach(
  ledger: ActivityLedger | null,
  period: Period,
  now = Date.now(),
): number {
  const from = ledgerSpeaksFrom(ledger);
  if (from === null) return 0;
  let count = 0;
  for (
    let at = periodStart(from, period);
    at.getTime() <= periodStart(now, period).getTime();
    at = nextPeriod(at, period)
  ) {
    count += 1;
    if (count > PERIOD_SPAN[period]) break;
  }
  return count;
}

/** The grains this record can actually be read at, coarsest last.
 *
 *  A three-day-old ledger offers days and nothing else, and the control that
 *  would have held one tab is not drawn at all — see `PERIOD_FLOOR`. */
export function offeredPeriods(
  ledger: ActivityLedger | null,
  now = Date.now(),
): Period[] {
  const offered = PERIODS.filter((period) =>
    period === "day" ? periodReach(ledger, period, now) >= 1 : periodReach(ledger, period, now) >= PERIOD_FLOOR,
  );
  return offered;
}

/**
 * TIME SAVED PER BUCKET, in minutes, against the reader's own baseline.
 *
 * The same arithmetic as `ledgerTimeSaved` and deliberately the same fields: the
 * credited runs only, words and seconds from the same runs or from neither
 * (ADR 0178). A second way to divide words by a typing speed is a second way to
 * get it wrong.
 */
export function savedSeries(
  ledger: ActivityLedger | null,
  period: Period,
  baselineWpm = TYPING_BASELINE_WPM,
  now = Date.now(),
): SeriesPoint[] {
  const baseline =
    Number.isFinite(baselineWpm) && baselineWpm > 0 ? baselineWpm : TYPING_BASELINE_WPM;
  return walk(
    ledger,
    period,
    (rows) => {
      let words = 0;
      let seconds = 0;
      let runs = 0;
      for (const row of rows) {
        words += row.saved_words ?? 0;
        seconds += row.saved_seconds ?? 0;
        runs += row.saved_runs ?? 0;
      }
      return {
        value: Math.max(0, words / baseline - seconds / 60),
        runs,
        /* A BUCKET WITH NO CREDITED RUN SAVED NOTHING, and that is a reading
           rather than a gap: the reader dictated nothing, or dictated only
           through Agent and Prompt Enhance, whose output is not credited. Either
           way nought minutes were saved and the column is honestly empty. */
        empty: runs === 0,
      };
    },
    now,
  );
}

/**
 * THE SPEAKING RATE PER BUCKET — spoken words over speech seconds.
 *
 * IT IS AN AGGREGATE AND THE TILE IS A MEDIAN, and the surface has to say so.
 * The tile divides the histogram in half over all time (ADR 0175); this divides
 * one bucket's words by that bucket's speaking seconds, which is
 * duration-weighted and reads a little lower where a long dictation sits in it.
 * They answer different questions — *how fast do I speak* against *how did this
 * week go* — and the day rows hold no histogram, so a per-bucket median is not
 * available at any price.
 */
export function rateSeries(
  ledger: ActivityLedger | null,
  period: Period,
  now = Date.now(),
): SeriesPoint[] {
  return walk(
    ledger,
    period,
    (rows) => {
      let words = 0;
      let seconds = 0;
      let runs = 0;
      for (const row of rows) {
        words += row.spoken_words ?? 0;
        seconds += row.speech_seconds ?? 0;
        runs += row.voiced ?? 0;
      }
      const measurable = runs > 0 && seconds > 0;
      return {
        value: measurable ? words / (seconds / 60) : 0,
        runs,
        /* NOT A ZERO. Nobody speaks at nought words a minute; a bucket with no
           voiced run has no rate at all, and the chart leaves it dark. */
        empty: !measurable,
      };
    },
    now,
  );
}

export interface BandBar {
  key: string;
  /** Under the axis: `<1s`, `1-2s`, `>5s`. */
  label: string;
  /** Spelled out, for the read-out line. */
  spoken: string;
  from: number;
  /** `null` is the open band at the top — everything above `from`. */
  to: number | null;
  count: number;
  /** Of every run in the histogram, 0 to 1. */
  share: number;
}

/**
 * THE EDGES A WAIT IS READ AT, IN MILLISECONDS, AND THERE ARE THREE SETS OF THEM
 * BECAUSE A LOCAL MODEL AND A COLD CLOUD LANE ARE NOT THE SAME DISPLAY.
 *
 * Each set is five bands: four closed ones and everything above the last edge.
 */
const BAND_EDGES: number[][] = [
  [250, 500, 1000, 2000],
  [1000, 2000, 3000, 5000],
  [2000, 5000, 10_000, 20_000],
];

/** `0.25`, `1`, `10` — a band edge as few characters as it can be said in. */
function spellSeconds(ms: number): string {
  const seconds = ms / 1000;
  if (seconds >= 10) return String(Math.round(seconds));
  if (Number.isInteger(seconds)) return String(seconds);
  return String(Number(seconds.toFixed(2)));
}

/**
 * THE WAIT AS FIVE NAMED BANDS RATHER THAN AS ITS OWN HISTOGRAM.
 *
 * **THE FINE HISTOGRAM WAS UNREADABLE AND THE OWNER SAID SO**, and the record
 * backs them up: 25 ms buckets re-binned to twenty-four columns put this
 * machine's 346 runs into 400 ms columns of which ELEVEN HELD NOTHING, with a
 * single run at 9.9 s stretching the axis over the whole empty right half. What
 * the reader was offered was `4.5 to 4.9 seconds - 3 dictations` beside the same
 * sentence reading zero. Neither is a question anybody has.
 *
 * *Under a second, half the time* is. So the columns are bands a person can hold
 * — under one second, one to two, and so on — each carrying its share, and the
 * top one is open so the tail is one column instead of eleven empty ones.
 *
 * **THE SET OF EDGES FOLLOWS THE MACHINE, not the other way round.** A local
 * model answering in 300 ms would put every run in the first band of the
 * ordinary set, which is one bar and no information; the fast set splits exactly
 * that range. The choice is made on the ninth decile, so it follows where the
 * runs actually are and not where the slowest one is.
 *
 * **A BAND WITH NOTHING IN IT IS STILL DRAWN — unless nothing above it is
 * either.** An empty band between two full ones is a real fact about the wait
 * (nothing ever took that long), while a run of empty bands off the top is only
 * the axis being longer than the record (ADR 0172).
 */
export function turnaroundBands(
  buckets: number[] | undefined,
  width: number,
): BandBar[] {
  const counts = buckets ?? [];
  const runs = counts.reduce((sum, count) => sum + count, 0);
  if (runs === 0) return [];

  const p90 = bucketQuantile(counts, width, 0.9) ?? 0;
  const edges =
    BAND_EDGES.find((set) => p90 < set[set.length - 1]) ?? BAND_EDGES[BAND_EDGES.length - 1];

  const bounds: Array<[number, number | null]> = edges.map((edge, index) => [
    index === 0 ? 0 : edges[index - 1],
    edge,
  ]);
  bounds.push([edges[edges.length - 1], null]);

  const bars: BandBar[] = bounds.map(([from, to]) => {
    let count = 0;
    for (let index = 0; index < counts.length; index += 1) {
      const at = index * width;
      if (at >= from && (to === null || at < to)) count += counts[index] ?? 0;
    }
    return {
      key: String(from),
      label:
        to === null
          ? `>${spellSeconds(from)}s`
          : from === 0
            ? `<${spellSeconds(to)}s`
            : `${spellSeconds(from)}-${spellSeconds(to)}s`,
      spoken:
        to === null
          ? `over ${spellSeconds(from)} seconds`
          : from === 0
            ? `under ${spellSeconds(to)} seconds`
            : `${spellSeconds(from)} to ${spellSeconds(to)} seconds`,
      from,
      to,
      count,
      share: count / runs,
    };
  });

  /* The trailing empties go and the interior ones stay — see the block above. */
  let last = bars.length - 1;
  while (last > 0 && bars[last].count === 0) last -= 1;
  return bars.slice(0, last + 1);
}

export interface CauseRow {
  /** The ledger's own key, `provider/model`. Used as a React key and never
   *  split back apart — a model id may contain a slash. */
  key: string;
  /** The model as the record spelled it, or the provider where a record kept no
   *  model name. Never prettified: this is an id the reader can look up. */
  model: string;
  provider: string;
  runs: number;
  /** Milliseconds, at the bucket's lower edge — the SAME axis as the bands
   *  drawn above the list, so a row can never disagree with the band it falls
   *  in (ADR 0181, one structure further out). */
  median: number;
}

/**
 * WHAT THE WAIT CAME FROM, PER MODEL, OFF THE LEDGER.
 *
 * **THIS USED TO READ THE HISTORY RECORDS AND WAS THE ONE READING ON HOME THAT
 * WAS NOT ALL-TIME.** The records are the only place `provider`, `model` and
 * `turnaround_ms` ever sat together, so grouping them was the only way to answer
 * *what causes it* — and history is capped, which at the reporting machine's
 * rate of about 196 dictations a day was roughly five days under the thousand
 * this ADR replaced, and is about twenty-five under the five thousand it set. A
 * lifetime median sat above that list, the two disagreed, and the surface had to
 * explain the discrepancy rather than remove it. A bigger cap moves the number
 * and not the defect: any cap is shorter than all time.
 *
 * **THE LEDGER LEARNED TO ANSWER IT (ADR 0240).** A distribution per recogniser
 * is exactly what that file is for — counts, no text, no growth with use — and
 * it costs about eight hundred bytes per model. The retry rule, the empty-model
 * fallback and the "no clock, no row" rule all moved into the runtime funnel
 * with it, which is why none of them appears here any more: this function now
 * shapes a map for a list and decides nothing.
 *
 * Sorted by how much of the record each group is, not by how slow it is. The
 * slowest row is often one run: this machine's whole tail above five seconds is
 * a SINGLE dictation on a second vendor, and sorting by median would have put
 * that one run at the top as though it were the finding.
 */
export function turnaroundCauses(ledger: ActivityLedger | null | undefined): CauseRow[] {
  const causes = ledger?.turnaround_causes;
  if (!causes) return [];

  const rows: CauseRow[] = [];
  for (const [key, cause] of Object.entries(causes)) {
    const buckets = cause?.buckets ?? [];
    const runs = buckets.reduce((sum, count) => sum + (count ?? 0), 0);
    if (runs === 0) continue;
    const median = bucketQuantile(buckets, TURNAROUND_BUCKET_MS, 0.5);
    if (median === null) continue;
    rows.push({
      key,
      model: cause.model || cause.provider,
      provider: cause.provider,
      runs,
      median,
    });
  }

  return rows.sort((left, right) => right.runs - left.runs || right.median - left.median);
}

/**
 * THE VALUE AT A QUANTILE OF A HISTOGRAM, at its bucket's lower edge.
 *
 * The same walk the median uses, with the midpoint moved — so a p90 and a median
 * read off one distribution can never disagree about which axis they are on,
 * which is the failure ADR 0181 recorded when a histogram written at one bucket
 * width was read at another.
 */
export function bucketQuantile(
  buckets: number[] | undefined,
  width: number,
  quantile: number,
): number | null {
  const counts = buckets ?? [];
  const runs = counts.reduce((sum, count) => sum + count, 0);
  if (runs === 0) return null;
  const target = Math.floor(runs * Math.min(1, Math.max(0, quantile)));
  let seen = 0;
  for (let index = 0; index < counts.length; index += 1) {
    seen += counts[index] ?? 0;
    if (seen > target) return index * width;
  }
  return (counts.length - 1) * width;
}

/** All-time minutes saved, retired days included. The one figure on the detail
 *  view that the tile deliberately does not carry: the tile is windowed so it
 *  stays something a reader can hold, and this is where the lifetime number is
 *  allowed to live. */
export function savedAllTime(
  ledger: ActivityLedger | null,
  baselineWpm = TYPING_BASELINE_WPM,
): number | null {
  const totals = ledgerTotals(ledger);
  if (totals.saved_runs <= 0) return null;
  const baseline =
    Number.isFinite(baselineWpm) && baselineWpm > 0 ? baselineWpm : TYPING_BASELINE_WPM;
  return Math.max(0, totals.saved_words / baseline - totals.saved_seconds / 60);
}

/** The best bucket of a series, or `null` where none of them holds a reading. */
export function bestPoint(points: SeriesPoint[]): SeriesPoint | null {
  let best: SeriesPoint | null = null;
  for (const point of points) {
    if (point.empty) continue;
    if (!best || point.value > best.value) best = point;
  }
  return best;
}
