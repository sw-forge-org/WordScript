import { describe, expect, it } from "vitest";
import {
  ACTIVITY_WEEKS,
  SAVED_WINDOW_DAYS,
  TYPING_BASELINE_WPM,
  activityStep,
  dayKey,
  ledgerBuckets,
  ledgerKeyToDayKey,
  ledgerTimeSaved,
  ledgerMedianTurnaround,
  ledgerMedianWpm,
  type ActivityLedger,
  type LedgerDay,
} from "./activity";

/**
 * THE CASE THAT MATTERS MOST HERE IS THE ONE WITH NO CLOCK. A run that never
 * measured itself contributes its WORDS and not its SECONDS, and a rate that
 * divided the first by a denominator missing the second would be a plausible
 * wrong number rather than a missing one. So every figure carries what it was
 * computed over, and these cases assert the counts as hard as the values.
 */

/** 2026-08-12, a Wednesday, at noon. Fixed, because a window is measured from
 *  today and a test that drifts with the calendar is not a test. */
const NOW = new Date(2026, 7, 12, 12, 0).getTime();

function key(daysBack: number): string {
  const date = new Date(NOW);
  date.setDate(date.getDate() - daysBack);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function row(overrides: Partial<LedgerDay> = {}): LedgerDay {
  return {
    dictations: 1,
    words: 100,
    recorded_seconds: 60,
    timed: 1,
    longest_seconds: 60,
    ...overrides,
  };
}

function ledger(
  days: Record<string, LedgerDay>,
  rates: number[] = [],
  turnarounds: number[] = [],
  startedOn?: string,
): ActivityLedger {
  return {
    started_on: startedOn ?? Object.keys(days).sort()[0] ?? null,
    days,
    rate_buckets: bucketsFor(rates),
    turnaround_buckets: turnaroundBucketsFor(turnarounds),
  };
}

/** The runtime's four hundred twenty-five-millisecond buckets. */
function turnaroundBucketsFor(values: number[]): number[] {
  const buckets = new Array<number>(400).fill(0);
  for (const ms of values) buckets[Math.min(Math.floor(ms / 25), 399)] += 1;
  return buckets;
}

/** The runtime's four hundred one-wpm buckets, from a list of per-run rates. */
function bucketsFor(rates: number[]): number[] {
  const buckets = new Array<number>(400).fill(0);
  for (const rate of rates) buckets[Math.min(Math.floor(rate), 399)] += 1;
  return buckets;
}

describe("the ledger's day keys", () => {
  it("converts the padded ISO key the file uses to the key the heat map parses", () => {
    /* Two formats exist on purpose: the ledger is a file a person may open,
       where `2026-08-06` sorts and `2026/8/6` does not. */
    expect(ledgerKeyToDayKey("2026-08-06")).toBe("2026/8/6");
    expect(ledgerKeyToDayKey("2026-12-31")).toBe("2026/12/31");
  });

  it("keys a moment by the date on the wall clock, not by UTC", () => {
    expect(dayKey(new Date(2026, 7, 12, 0, 30).getTime())).toBe("2026/8/12");
  });
});

describe("the calendar's buckets", () => {
  it("carries a day's counts across and drops a day with no dictations", () => {
    const buckets = ledgerBuckets(
      ledger({
        [key(0)]: row({ dictations: 3, words: 154, recorded_seconds: 300, timed: 2, longest_seconds: 240 }),
        [key(1)]: row({ dictations: 0, words: 0, recorded_seconds: 0, timed: 0, longest_seconds: 0 }),
      }),
    );

    const today = buckets.get(dayKey(NOW))!;
    expect(today.dictations).toBe(3);
    expect(today.words).toBe(154);
    expect(today.seconds).toBe(300);
    expect(today.longestSeconds).toBe(240);
    /* Two of the three carried a clock, and the bucket says so rather than
       implying all three did. */
    expect(today.timed).toBe(2);
    expect(buckets.size).toBe(1);
  });

  it("is empty when there is no ledger at all", () => {
    expect(ledgerBuckets(null).size).toBe(0);
  });
});

describe("the ramp", () => {
  it("is unlit at nothing, and nothing is not a count of none", () => {
    expect(activityStep(0)).toBe(0);
    expect(activityStep(-3)).toBe(0);
    expect(activityStep(Number.NaN)).toBe(0);
  });

  it("lights every threshold in order", () => {
    expect(activityStep(1)).toBe(1);
    expect(activityStep(2)).toBe(1);
    expect(activityStep(3)).toBe(2);
    expect(activityStep(6)).toBe(3);
    expect(activityStep(11)).toBe(4);
    expect(activityStep(400)).toBe(4);
  });

  it("does not rescale to the busiest day", () => {
    /* The whole reason the thresholds are fixed: one dictation is the dimmest
       lit step whether or not some other day had forty. */
    expect(activityStep(1)).toBe(1);
  });
});

describe("words per minute — a median, all time", () => {
  it("reports the MIDDLE run's rate rather than an average of them", () => {
    /* Five runs. The mean is 108; the median is 90, and the median is what a
       typical dictation actually ran at. */
    const reading = ledgerMedianWpm(
      ledger({ [key(0)]: row({ dictations: 5, timed: 5 }) }, [60, 80, 90, 110, 200]),
    )!;
    expect(reading.value).toBe(90);
  });

  it("IS NOT MOVED BY THE HALLUCINATED OUTLIER THAT MOVES A MEAN", () => {
    /* The measured case: a two-second capture the recogniser invented ten words
       for, reporting 273 wpm. It is one run either way — it drags a mean of five
       by thirty words a minute and a median by nothing. */
    const without = ledgerMedianWpm(
      ledger({ [key(0)]: row({ dictations: 5, timed: 5 }) }, [80, 85, 90, 95, 100]),
    )!;
    const withOutlier = ledgerMedianWpm(
      ledger({ [key(0)]: row({ dictations: 5, timed: 5 }) }, [80, 85, 90, 95, 273]),
    )!;
    expect(withOutlier.value).toBe(without.value);
  });

  it("clamps a rate past the top bucket into it rather than dropping the run", () => {
    /* Dropping it would be a silent edit of the distribution. Held at the edge
       it still counts as one run, which is all a median needs from it. */
    const reading = ledgerMedianWpm(
      ledger({ [key(0)]: row({ dictations: 3, timed: 3 }) }, [50, 900, 1000]),
    )!;
    expect(reading.value).toBe(399);
  });

  it("REACHES PAST ANYTHING HISTORY WOULD HAVE PRUNED", () => {
    /* The whole reason the ledger exists: three hundred days apart is well past
       any retention horizon history keeps, and both runs still count. */
    const reading = ledgerMedianWpm(
      ledger(
        { [key(300)]: row({ timed: 1 }), [key(0)]: row({ timed: 1 }) },
        [80, 100],
      ),
    )!;
    expect(reading.timed).toBe(2);
  });

  it("says how many runs it was computed over, and how many there were", () => {
    const reading = ledgerMedianWpm(
      ledger({ [key(0)]: row({ dictations: 5, timed: 2 }) }, [80, 100]),
    )!;
    expect(reading.timed).toBe(2);
    expect(reading.total).toBe(5);
  });

  it("is null when nothing timed itself, which is not a rate of zero", () => {
    expect(ledgerMedianWpm(null)).toBeNull();
    expect(ledgerMedianWpm(ledger({}))).toBeNull();
    expect(
      ledgerMedianWpm(ledger({ [key(0)]: row({ dictations: 2, timed: 0 }) }, [])),
    ).toBeNull();
  });
});

describe("time saved, the one figure that stays windowed", () => {
  it("measures the words against the typing baseline and subtracts the speaking", () => {
    /* 400 words at 40 wpm is 10 minutes of typing; they were said in 120 s. */
    const reading = ledgerTimeSaved(
      ledger({ [key(0)]: row({ words: 400, recorded_seconds: 120 }) }),
      NOW,
    )!;
    expect(TYPING_BASELINE_WPM).toBe(40);
    expect(reading.value).toBeCloseTo(8, 6);
  });

  it("LOOKS AT FOUR WEEKS AND NOTHING BEFORE THEM, while the rate looks at everything", () => {
    const source = ledger(
      {
        [key(1)]: row({ words: 400, recorded_seconds: 120 }),
        [key(SAVED_WINDOW_DAYS + 5)]: row({ words: 4000, recorded_seconds: 1200 }),
      },
      [200, 200],
    );
    expect(SAVED_WINDOW_DAYS).toBe(28);

    const saved = ledgerTimeSaved(source, NOW)!;
    expect(saved.timed).toBe(1);
    expect(saved.value).toBeCloseTo(8, 6);

    /* The same ledger, read all-time by the rate: both days are in it. Two
       scopes on one row, which is the thing this case exists to hold apart. */
    expect(ledgerMedianWpm(source)!.timed).toBe(2);
  });

  it("keeps the oldest day inside the window rather than off it by one", () => {
    const edge = ledgerTimeSaved(
      ledger({ [key(SAVED_WINDOW_DAYS - 1)]: row({ words: 400, recorded_seconds: 120 }) }),
      NOW,
    );
    expect(edge).not.toBeNull();
  });

  it("floors at zero rather than reporting negative minutes saved", () => {
    /* 10 words in 120 s: slower than typing them would have been. */
    expect(
      ledgerTimeSaved(ledger({ [key(0)]: row({ words: 10, recorded_seconds: 120 }) }), NOW)!.value,
    ).toBe(0);
  });

  it("is null when the window holds nothing that timed itself", () => {
    expect(ledgerTimeSaved(null, NOW)).toBeNull();
    expect(ledgerTimeSaved(ledger({}), NOW)).toBeNull();
    expect(
      ledgerTimeSaved(ledger({ [key(90)]: row({ words: 400, recorded_seconds: 120 }) }), NOW),
    ).toBeNull();
  });
});

describe("turnaround — the one figure a setting can move", () => {
  it("reports the middle wait and not the average of them", () => {
    /* Sorted: 900, 1000, 1100, 1210, 7250. The mean is 2,292 ms — visibly above
       four of the five — and the middle one is 1,100, which is what the next
       dictation will actually cost. One cold start behind a model that had to
       load must not set the expectation for every dictation after it. */
    const reading = ledgerMedianTurnaround(
      ledger({}, [], [900, 1000, 1210, 1100, 7250]),
    )!;
    expect(reading).toBe(1100);
  });

  it("is null when nothing has been timed, which is not a wait of zero", () => {
    expect(ledgerMedianTurnaround(null)).toBeNull();
    expect(ledgerMedianTurnaround(ledger({}, [], []))).toBeNull();
  });

  it("holds anything past ten seconds at the top rather than dropping it", () => {
    /* Past ten seconds is a failure rather than a measurement, but it still
       happened, and dropping it would edit the distribution silently. */
    expect(ledgerMedianTurnaround(ledger({}, [], [30000, 40000, 50000]))!).toBe(9975);
  });
});
