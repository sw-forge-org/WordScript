import { describe, expect, it } from "vitest";
import type { ActivityLedger, LedgerDay } from "./activity";
import {
  bestPoint,
  bucketQuantile,
  turnaroundBands,
  offeredPeriods,
  periodStart,
  rateSeries,
  savedAllTime,
  savedSeries,
} from "./series";

/**
 * WHAT A BUCKETED SERIES CAN GET WRONG, AND IT IS NEVER THE ARITHMETIC. It is
 * the edges: which bucket a day falls in, which buckets exist at all, and
 * whether a bucket with nothing in it is a zero or an absence. All three are
 * assertions here, because all three are invisible on a chart that looks fine.
 */

/** 2026-08-12, a Wednesday, at noon. Its week begins Monday the 10th. */
const NOW = new Date(2026, 7, 12, 12, 0).getTime();
const DAY = 24 * 60 * 60 * 1000;

function iso(daysBack: number): string {
  const date = new Date(NOW - daysBack * DAY);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function row(overrides: Partial<LedgerDay> = {}): LedgerDay {
  return {
    dictations: 1,
    words: 100,
    spoken_words: 100,
    recorded_seconds: 60,
    speech_seconds: 60,
    timed: 1,
    voiced: 1,
    saved_runs: 1,
    saved_words: 100,
    saved_seconds: 60,
    longest_seconds: 60,
    ...overrides,
  };
}

function ledger(
  days: Record<string, LedgerDay>,
  extra: Partial<ActivityLedger> = {},
): ActivityLedger {
  return {
    started_on: Object.keys(days).sort()[0] ?? null,
    days,
    ...extra,
  };
}

describe("which bucket a day falls in", () => {
  /* THE WEEK STARTS ON MONDAY (ADR 0235), the same as the grid above it. A chart
     and a calendar on one screen that disagree about a week is a reader counting
     columns twice. */
  it("opens a week on Monday and a month on the first", () => {
    expect(periodStart(new Date(2026, 7, 12), "week").getDate()).toBe(10);
    expect(periodStart(new Date(2026, 7, 9), "week").getDate()).toBe(3);
    expect(periodStart(new Date(2026, 7, 12), "month").getDate()).toBe(1);
    expect(periodStart(new Date(2026, 7, 12), "year").getMonth()).toBe(0);
  });

  it("folds every day of one week into one column", () => {
    const source = ledger({
      [iso(0)]: row({ saved_words: 400, saved_seconds: 120 }),
      [iso(1)]: row({ saved_words: 400, saved_seconds: 120 }),
    });
    const weeks = savedSeries(source, "week", 40, NOW);

    expect(weeks).toHaveLength(1);
    /* 800 words at 40 wpm is twenty minutes of typing, less the four spent
       saying them. */
    expect(weeks[0].value).toBeCloseTo(16, 6);
    expect(weeks[0].runs).toBe(2);
    expect(weeks[0].full).toContain("week of 10 Aug");
  });
});

describe("what the series may draw at all", () => {
  /* ADR 0172's rule, one display over: a bucket the record cannot speak for is
     not drawn. The series therefore begins at the first day the rows reach, not
     at the window's edge — an empty column before the record began would assert
     that nothing was dictated in a week the file never held. */
  it("begins where the record begins and ends at today", () => {
    const days = savedSeries(ledger({ [iso(2)]: row() }), "day", 40, NOW);
    expect(days).toHaveLength(3);
    expect(days[days.length - 1].label).toBe("12");
  });

  /* IT USED TO SAY *starts after a retirement*, and the stamp it started after
     is deleted (ADR 0244). The claim underneath is unchanged: a DAY series may
     not reach past the day rows, however far back the record as a whole goes. */
  it("starts at the oldest day row however old the record is", () => {
    const source = ledger({ [iso(2)]: row() }, {
      started_on: iso(400),
      months: { "2025-06": row() },
    });
    /* The record is over a year old and the day tier holds three days. */
    expect(savedSeries(source, "day", 40, NOW)).toHaveLength(3);
  });

  /* THE GRAIN IS OFFERED WHERE THE RECORD CAN FILL IT (ADR 0183's rule again). A
     `Years` tab holding one bar teaches nothing and costs a press to find out. */
  it("offers only the grains the record reaches over", () => {
    expect(offeredPeriods(ledger({ [iso(2)]: row() }), NOW)).toEqual(["day"]);
    expect(offeredPeriods(ledger({ [iso(20)]: row() }), NOW)).toEqual(["day", "week"]);
    expect(offeredPeriods(ledger({ [iso(80)]: row() }), NOW)).toEqual(["day", "week", "month"]);
    expect(offeredPeriods(null, NOW)).toEqual([]);
  });
});

describe("a bucket with nothing in it", () => {
  /* THE TWO CLAIMS DIFFER AND THE CHART DRAWS THEM DIFFERENTLY. A day with no
     dictation saved no time, which is a reading; the same day has no speaking
     rate at all, and nought words a minute is a thing nobody has ever done. */
  it("saved nothing, and had no rate whatsoever", () => {
    const source = ledger({
      [iso(2)]: row({ saved_words: 400, saved_seconds: 120, spoken_words: 400, speech_seconds: 120 }),
    });

    const saved = savedSeries(source, "day", 40, NOW);
    expect(saved[0].empty).toBe(false);
    expect(saved[2].empty).toBe(true);
    expect(saved[2].value).toBe(0);

    const rate = rateSeries(source, "day", NOW);
    expect(rate[0].value).toBeCloseTo(200, 6);
    expect(rate[2].empty).toBe(true);

    /* And the best column skips the empty ones rather than reading one as a
       tie. */
    expect(bestPoint(saved)!.key).toBe(saved[0].key);
  });
});

describe("the all-time figures the tile deliberately does not carry", () => {
  it("counts the aged-out days into the lifetime total", () => {
    const source = ledger({ [iso(0)]: row({ saved_words: 400, saved_seconds: 120 }) }, {
      months: { "2024-03": row({ saved_words: 4000, saved_seconds: 1200 }) },
    });
    /* 4,400 words at 40 wpm is 110 minutes, less the 22 spent saying them. */
    expect(savedAllTime(source, 40)).toBeCloseTo(88, 6);
  });

  it("has no lifetime figure where nothing was ever credited", () => {
    expect(savedAllTime(ledger({ [iso(0)]: row({ saved_runs: 0, saved_words: 0 }) }))).toBeNull();
  });
});

describe("the wait, as bands and as a quantile", () => {
  /* THE FINE HISTOGRAM IS GONE FROM THE SCREEN AND THE BANDS REPLACED IT, so
     what is asserted here is what the owner's complaint was about: the shape a
     reader is handed, not the re-binning that produced eleven empty columns. */
  it("puts every run in a band and the shares add up", () => {
    const buckets = new Array<number>(400).fill(0);
    buckets[20] = 6; // 500 ms
    buckets[60] = 3; // 1500 ms
    const bars = turnaroundBands(buckets, 25);

    expect(bars.reduce((sum, bar) => sum + bar.count, 0)).toBe(9);
    expect(bars.reduce((sum, bar) => sum + bar.share, 0)).toBeCloseTo(1, 6);
    expect(turnaroundBands(new Array<number>(400).fill(0), 25)).toEqual([]);
  });

  it("drops the empty bands off the top and keeps the ones under a full one", () => {
    /* Nothing ever took longer than 1.6 s, so the open band above is the axis
       being longer than the record and goes. The two empty bands BELOW the runs
       stay: *nothing was ever that fast* is a fact about the wait, and dropping
       them would slide the whole shape to the left edge (ADR 0172). */
    const buckets = new Array<number>(400).fill(0);
    buckets[20] = 5; // 0.5 s
    buckets[64] = 2; // 1.6 s
    const bars = turnaroundBands(buckets, 25);

    expect(bars.map((bar) => bar.label)).toEqual(["<0.25s", "0.25-0.5s", "0.5-1s", "1-2s"]);
    expect(bars.map((bar) => bar.count)).toEqual([0, 0, 5, 2]);
  });

  it("follows the machine: a local model that answers in a blink gets finer bands", () => {
    /* Every run under 300 ms lands in the ordinary set's first band, which is
       one bar and no information. The fast set splits exactly that range. */
    const quick = new Array<number>(400).fill(0);
    quick[4] = 10; // 100 ms
    quick[12] = 4; // 300 ms
    expect(turnaroundBands(quick, 25).map((bar) => bar.label)).toEqual(["<0.25s", "0.25-0.5s"]);

    const slow = new Array<number>(400).fill(0);
    slow[280] = 5; // 7 s
    expect(turnaroundBands(slow, 25)[0].label).toBe("<2s");
  });

  /* THE QUANTILE READS THE SAME AXIS THE MEDIAN DOES, which is the failure ADR
     0181 recorded: a histogram written at one bucket width and read at another
     reported 17 where the truth was 88. */
  it("reads a quantile at its bucket's lower edge", () => {
    const buckets = new Array<number>(400).fill(0);
    for (let index = 0; index < 10; index += 1) buckets[index * 2] = 1;
    expect(bucketQuantile(buckets, 25, 0.5)).toBe(10 * 25);
    expect(bucketQuantile(buckets, 25, 0.9)).toBe(18 * 25);
    expect(bucketQuantile(undefined, 25, 0.5)).toBeNull();
  });
});

/**
 * THE PROPERTY THIS WHOLE TIER LADDER EXISTS FOR (ADR 0243): A CHART DOES NOT
 * STOP LEARNING.
 *
 * Before the month tier, a retired day was folded into one opaque total and
 * every grain shared the day horizon — so `Months` could never hold more than 26
 * buckets and `Years` could never hold more than three, on an installation of
 * any age. These cases are that ceiling, asserted from the other side.
 */
describe("how far back a grain can reach", () => {
  /** A ledger holding nothing but month rows — the shape every installation
   *  older than `LEDGER_DAY_ROWS` days ends up in. */
  function aged(years: number): ActivityLedger {
    const months: Record<string, LedgerDay> = {};
    const start = new Date(NOW);
    for (let back = 1; back <= years * 12; back += 1) {
      const at = new Date(start.getFullYear(), start.getMonth() - back, 1);
      months[`${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}`] = row();
    }
    return ledger({ [iso(0)]: row() }, { months });
  }

  it("offers years on a record whose days have all aged out", () => {
    const eight = aged(8);
    /* THE ASSERTION THAT WOULD HAVE FAILED BEFORE THE MONTH TIER. The day tier
       holds one day — everything older was folded away — and the year grain
       reads the month tier instead, which reaches eight years. */
    expect(offeredPeriods(eight, NOW)).toContain("year");
    expect(offeredPeriods(eight, NOW)).toContain("month");

    const yearly = savedSeries(eight, "year", 40, NOW);
    expect(yearly.length).toBeGreaterThan(3);
    /* AND IT IS CLIPPED BY THE CHART'S OWN SPAN, not by the record: ten year
       buckets is `PERIOD_SPAN`, and a nine-year-old record fills nine of them. */
    expect(yearly.length).toBeLessThanOrEqual(10);
  });

  it("keeps days and weeks on the day tier, which is the one that rolls", () => {
    const eight = aged(8);
    /* A DAY GRAIN MAY NOT BORROW A MONTH ROW. Eight years of months are behind
       this record and the day tier holds one row, so the daily series draws that
       one day and does not invent 2,900 of them. */
    expect(savedSeries(eight, "day", 40, NOW).length).toBe(1);
  });

  it("adds the live days to the month they belong to, and counts nothing twice", () => {
    /* THE TIER CONTRACT: a month row holds what has aged out and the day rows
       hold the rest. The current month is both, and reading either alone is a
       figure that is wrong in a direction nobody can see. */
    const thisMonth = `${new Date(NOW).getFullYear()}-${String(
      new Date(NOW).getMonth() + 1,
    ).padStart(2, "0")}`;
    const split = ledger(
      { [iso(0)]: row({ dictations: 2, saved_words: 200, saved_seconds: 60, saved_runs: 2 }) },
      { months: { [thisMonth]: row({ dictations: 5, saved_words: 500, saved_seconds: 150, saved_runs: 5 }) } },
    );

    const monthly = savedSeries(split, "month", 40, NOW);
    const current = monthly[monthly.length - 1];
    expect(current.runs).toBe(7);
  });
});
