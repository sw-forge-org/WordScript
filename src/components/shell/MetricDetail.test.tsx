import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MetricDetail } from "./MetricDetail";
import type { ActivityLedger, LedgerCause, LedgerDay } from "@/lib/activity";

/**
 * TWO RULES THIS VIEW CAN BREAK, AND EVERY CASE HERE IS ONE OF THEM.
 *
 * **DRAWING A HISTORY THAT DOES NOT EXIST.** The ledger's day rows carry words,
 * seconds, waits and languages, so all four readings can be walked over time —
 * but only from the day each field arrived. A chart that spread an all-time
 * figure evenly over the weeks would be the plausible wrong number this whole
 * track is built against.
 *
 * **SAYING A NUMBER MEANS SOMETHING IT DOES NOT.** Until ADR 0247 the two cause
 * lists both drew the end-to-end wait under headings that promised the model's
 * time and the mode's cost. The number was right and both headings were wrong,
 * which is the failure a reader cannot detect. The split cases below are that
 * distinction: what was measured, what was not, and what the surface may claim
 * from each.
 */

afterEach(cleanup);

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
    dictations: 4,
    words: 400,
    spoken_words: 400,
    recorded_seconds: 120,
    speech_seconds: 120,
    timed: 4,
    voiced: 4,
    saved_runs: 4,
    saved_words: 400,
    saved_seconds: 120,
    longest_seconds: 60,
    ...overrides,
  };
}

function ledger(days: Record<string, LedgerDay>, extra: Partial<ActivityLedger> = {}): ActivityLedger {
  return {
    started_on: Object.keys(days).sort()[0] ?? null,
    days,
    ...extra,
  };
}

/** The lead's own two lines: what the figure IS, and what qualifies it.
 *
 *  READ AS TEXT AND NOT BY LABEL, because the whole point of the block is that
 *  it is a sentence rather than a label beside a value. A case that asserted
 *  `fact("Median")` would pass on a screen that had gone back to being a grid of
 *  three-word headings, which is the thing being replaced. */
function lead(): string {
  return document.querySelector(".ws-metric-lead-say")?.textContent?.trim() ?? "";
}

function notes(): string {
  return document.querySelector(".ws-metric-lead-notes")?.textContent?.trim() ?? "";
}

/** One row of the split table, by the name in its first cell. */
function splitRow(name: string): string[] | null {
  const rows = Array.from(document.querySelectorAll("li.ws-metric-split-row"));
  const found = rows.find(
    (each) => each.querySelector(".ws-metric-split-name")?.textContent?.startsWith(name),
  );
  if (!found) return null;
  return Array.from(found.children).map((cell) => cell.textContent?.trim() ?? "");
}

/** The split table's column headings, which are the whole of ADR 0247's fix:
 *  the old table had none at all. */
function splitColumns(): string[] {
  return Array.from(document.querySelectorAll(".ws-metric-split-columns span"))
    .map((cell) => cell.textContent?.trim() ?? "")
    .filter((text) => text.length > 0);
}

function draw(
  metric: Parameters<typeof MetricDetail>[0]["metric"],
  source: ActivityLedger | null,
) {
  return render(
    <MetricDetail metric={metric} ledger={source} baseline={40} onBack={vi.fn()} now={NOW} />,
  );
}

function bucketsOf(waits: number[]): number[] {
  const buckets = new Array<number>(400).fill(0);
  for (const wait of waits) buckets[Math.floor(wait / 25)] += 1;
  return buckets;
}

/** One mode's row in `mode_causes` — the same 25 ms axis, without the
 *  provider/model envelope, because a mode is already its own key. */
const modeBuckets = bucketsOf;

/** One recogniser's row in the ledger's cause map, spelled as waits in
 *  milliseconds rather than as bucket indices — the arithmetic is the thing the
 *  cases are about, so writing it out by hand would hide it.
 *
 *  `heard` is the recogniser's own share of those same waits (ADR 0247), and
 *  leaving it out is the state every existing installation is in: the totals are
 *  full and nothing on disk can say how they divide.
 *
 *  The model names are invented on purpose: a catalogued id spelled outside
 *  `shared/` fails its own test (ADR 0115), and this list only ever prints what
 *  the ledger holds. */
function cause(
  provider: string,
  model: string,
  waits: number[],
  heard?: number[],
): LedgerCause {
  return {
    provider,
    model,
    buckets: bucketsOf(waits),
    ...(heard ? { heard_buckets: bucketsOf(heard) } : {}),
  };
}

describe("time saved, opened up", () => {
  it("draws one column per day the record reaches and states the lifetime figure first", () => {
    const { container } = draw("saved", ledger({ [iso(0)]: row(), [iso(1)]: row() }));

    expect(container.querySelectorAll(".ws-chart-col")).toHaveLength(2);
    /* 800 words at 40 wpm is twenty minutes of typing, less the four spent
       saying them — and the ladder spells it the way the tile does (ADR 0233). */
    expect(lead()).toBe("16 minutes of typing saved, all time");
  });

  /* THE ASSUMPTION IN THE DIVISOR AND THE MODES OUTSIDE THE FIGURE ARE BOTH
     CLAUSES OF THE READING (ADR 0247). The second used to be the closing
     sentence of a paragraph at the foot of the view, which is where a reader
     arrives after they have already decided what the number means. */
  it("names its own baseline and what it does not count, beside the figure", () => {
    draw("saved", ledger({ [iso(0)]: row() }));

    expect(notes()).toContain("against typing at 40 wpm");
    expect(notes()).toContain("Draft and Prompt Enhance");
  });

  /* A CONTROL WITH ONE OPTION IS FURNITURE. The grains appear as the record grows
     into them, the same way the year picker fills (ADR 0183). */
  it("draws no grain control until there is a grain to choose", () => {
    draw("saved", ledger({ [iso(1)]: row() }));
    expect(screen.queryByRole("group", { name: "Which grain" })).toBeNull();

    cleanup();
    draw("saved", ledger({ [iso(20)]: row(), [iso(0)]: row() }));
    expect(screen.getByRole("group", { name: "Which grain" })).toBeInTheDocument();
    /* And it opens at the coarsest grain the record can fill, because the
       opening question is *how is it going*. */
    expect(screen.getByRole("button", { name: "Weeks" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("the two metrics that had no history until ADR 0243", () => {
  /* THIS CASE ASSERTED AN ABSENCE AND THE ABSENCE IS GONE. It read *no grain
     control* and *spread rather than a history* — both true of a ledger whose
     day rows carried no wait, and both false now that they do. The spread is
     still drawn and is still the finer answer; what has been added is the
     history beside it. */
  it("draws turnaround as a spread AND as a history, off two different axes", () => {
    const buckets = new Array<number>(400).fill(0);
    buckets[40] = 6;
    buckets[120] = 2;
    draw("turnaround", ledger({ [iso(60)]: row() }, { turnaround_buckets: buckets }));

    /* THE SPREAD IS UNCHANGED: a median at 1.0 s and a p90 at 3.0 s, off the
       same 25 ms axis the bands are drawn on. What moved is where they are said
       — the reading is the first line rather than the third label of a grid. */
    expect(lead()).toBe("1.0 s from you stopping to the text being ready");
    expect(notes()).toContain("9 in 10 came back under 3.0 s");
    expect(screen.queryByText(/spread rather than a history/)).toBeNull();
  });

  /* A SERIES NEEDS THE ROWS TO CARRY THE FIELD, AND A STAMP SAYING FROM WHEN.
     Without `measured_from` the chart is not drawn at all — which is the rule
     that stops a period predating a field being painted as a zero, and is
     exactly the state every existing installation is in on the day this ships. */
  it("draws no wait history until the rows carry one, and never a zero for the days before", () => {
    const buckets = new Array<number>(400).fill(0);
    buckets[40] = 2;

    draw("turnaround", ledger({ [iso(1)]: row({ turnaround_runs: 2, turnaround_ms_sum: 2000 }) }, { turnaround_buckets: buckets }));
    expect(screen.queryByLabelText(/The middle wait per/)).toBeNull();
  });

  /* WHAT CAUSED IT IS THE QUESTION TURNAROUND IS OPENED WITH (ADR 0236), and
     until ADR 0240 the ledger could not answer it. The rows sum to the bands,
     and the retry and no-clock rules live in the runtime funnel where they are
     tested once. */
  it("names the models the wait came from, all-time, off the ledger", () => {
    const buckets = new Array<number>(400).fill(0);
    buckets[40] = 3;
    draw(
      "turnaround",
      ledger(
        { [iso(1)]: row() },
        {
          turnaround_buckets: buckets,
          turnaround_causes: {
            "vendor-one/fast-recogniser": cause("vendor-one", "fast-recogniser", [1000, 1200]),
            "groq/slow-recogniser": cause("groq", "slow-recogniser", [5800]),
            /* A pair the runtime knows and never timed. It is not a nought. */
            "groq/never-ran": cause("groq", "never-ran", []),
          },
        },
      ),
    );

    expect(screen.getByText("The same 3 waits")).toBeInTheDocument();
    /* 1200 ms falls in bucket 48, whose lower edge is 1200 — the same axis the
       bands above are drawn on, which is the point of reading the row off the
       histogram rather than off the raw waits. */
    expect(splitRow("fast-recogniser")).toEqual(["fast-recogniservia vendor-one", "2", "1.2 s"]);
    expect(splitRow("slow-recogniser")).toEqual(["slow-recogniservia Groq", "1", "5.8 s"]);
    expect(splitRow("never-ran")).toBeNull();
  });

  /* A LEDGER WRITTEN BEFORE THE MAP EXISTED STILL DRAWS ITS BANDS. The seed
     fills the causes on the next launch (ADR 0240); until then the block above
     is complete and this one is simply absent, which is the honest shape of *no
     reading* — not a table with no rows. */
  it("draws no split table where the ledger has no causes", () => {
    const buckets = new Array<number>(400).fill(0);
    buckets[40] = 8;
    draw("turnaround", ledger({ [iso(1)]: row() }, { turnaround_buckets: buckets }));

    expect(document.querySelector(".ws-metric-split")).toBeNull();
  });

  /* THE TWO CUTS OF THE TURNAROUND ARE ONE TABLE AND SAY SO (ADR 0244,
     ADR 0247). The owner read two stacked lists, each ending in its own total,
     and asked outright whether they add up or are already split. One heading
     over one toggle says outright that the control re-cuts a set rather than
     showing a second one. */
  it("cuts one set of waits two ways rather than drawing two lists", () => {
    const buckets = new Array<number>(400).fill(0);
    buckets[40] = 3;
    draw(
      "turnaround",
      ledger(
        { [iso(1)]: row() },
        {
          turnaround_buckets: buckets,
          turnaround_causes: {
            "vendor-one/fast-recogniser": cause("vendor-one", "fast-recogniser", [1000, 1200, 1000]),
          },
          mode_causes: {
            cleanup: modeBuckets([1000, 1200]),
            agent: modeBuckets([4100]),
          },
        },
      ),
    );

    expect(screen.getByText("The same 3 waits")).toBeInTheDocument();
    expect(splitRow("fast-recogniser")).not.toBeNull();
    expect(splitRow("Cleanup")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "by mode" }));
    expect(screen.getByText("The same 3 waits")).toBeInTheDocument();
    /* The upper of two is the median this walk reports — the same rule the bands
       above are read with, so a row can never disagree with the band it sits
       in (ADR 0181). */
    expect(splitRow("Cleanup")).toEqual(["Cleanup", "2", "1.2 s"]);
    expect(splitRow("Draft")).toEqual(["Draft", "1", "4.1 s"]);
    expect(splitRow("fast-recogniser")).toBeNull();
  });

  /* AND WHERE A CUT IS NOT THE WHOLE SET IT SAYS SO IN THE HEADING. A run whose
     record names no mode is counted in the histogram and in no row of this cut,
     so the list can be short of the one beside it — which until ADR 0244 was
     disclosed only in a source comment claiming the surface stated it. */
  it("says how short a cut is where a run named no mode", () => {
    const buckets = new Array<number>(400).fill(0);
    buckets[40] = 4;
    draw(
      "turnaround",
      ledger(
        { [iso(1)]: row() },
        {
          turnaround_buckets: buckets,
          turnaround_causes: {
            "vendor-one/fast-recogniser": cause("vendor-one", "fast-recogniser", [
              1000, 1200, 1000, 4100,
            ]),
          },
          /* Three runs the mode is known for. The fourth carries no
             `effective_mode`, which is every record written before that field
             existed. */
          mode_causes: { cleanup: modeBuckets([1000, 1200]), agent: modeBuckets([4100]) },
        },
      ),
    );

    expect(screen.getByText("The same 4 waits")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "by mode" }));
    expect(screen.getByText("3 of the same 4 waits")).toBeInTheDocument();
  });
});

/**
 * ADR 0247 — THE DEFECT THAT WAS A NUMBER MEANING SOMETHING ELSE.
 *
 * Both cause maps held the end-to-end wait, so a model row and a mode row drew
 * one figure twice under headings promising the recogniser's time and the mode's
 * cost. Nothing on the surface was wrong except every word of it. These cases
 * are the two states that replace it: measured, and honestly not measured.
 */
describe("where the wait went", () => {
  const buckets = new Array<number>(400).fill(0);
  buckets[40] = 2;

  it("charges the recogniser only for the part it was there for", () => {
    draw(
      "turnaround",
      ledger(
        { [iso(1)]: row() },
        {
          turnaround_buckets: buckets,
          turnaround_causes: {
            "vendor-one/fast-recogniser": cause(
              "vendor-one",
              "fast-recogniser",
              [1000, 1000],
              [600, 600],
            ),
          },
        },
      ),
    );

    /* THE COLUMN HEADER IS THE WHOLE FIX AND IT COST THREE WORDS. The old table
       had none: a name, a run count, and a bare figure in seconds whose meaning
       the reader had to guess — which is exactly what the owner could not do. */
    expect(splitColumns()).toEqual(["runs", "heard in", "in total"]);
    expect(splitRow("fast-recogniser")).toEqual([
      "fast-recogniservia vendor-one",
      "2",
      "0.6 s",
      "1.0 s",
    ]);
  });

  it("charges the mode the remainder rather than the whole wait", () => {
    draw(
      "turnaround",
      ledger(
        { [iso(1)]: row() },
        {
          turnaround_buckets: buckets,
          turnaround_causes: {
            "vendor-one/fast-recogniser": cause(
              "vendor-one",
              "fast-recogniser",
              [1000, 1000],
              [600, 600],
            ),
          },
          mode_causes: { cleanup: modeBuckets([1000, 1000]) },
          mode_transform_causes: { cleanup: modeBuckets([400, 400]) },
        },
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "by mode" }));
    expect(splitColumns()).toEqual(["runs", "rewrote in", "in total"]);
    expect(splitRow("Cleanup")).toEqual(["Cleanup", "2", "0.4 s", "1.0 s"]);
  });

  /* NO HISTORY RECORD EVER KEPT TWO DURATIONS, so a machine with a year of
     dictation behind it starts with the split measured on none of its runs. A
     column of dashes reads as a broken table; no column, and a clause saying
     when it arrives, reads as what it is. */
  it("draws no stage column at all until something has filled it", () => {
    draw(
      "turnaround",
      ledger(
        { [iso(1)]: row() },
        {
          turnaround_buckets: buckets,
          turnaround_causes: {
            "vendor-one/fast-recogniser": cause("vendor-one", "fast-recogniser", [1000, 1000]),
          },
        },
      ),
    );

    expect(splitColumns()).toEqual(["runs", "in total"]);
    expect(splitRow("fast-recogniser")).toEqual(["fast-recogniservia vendor-one", "2", "1.0 s"]);
    expect(screen.getByText(/split from your next dictation onwards/)).toBeInTheDocument();
  });
});

/* THE LANGUAGE POPULATIONS, WHICH ADR 0244 CUT FROM THREE TO TWO. The third —
   *Never asked* — measured how far back the SEED could reach, was non-zero on
   exactly one machine in the world, and is structurally zero on the live path:
   every counted dictation increments one of the two that remain. What the case
   asserts is the arithmetic that replaced it. */
describe("languages, opened up", () => {
  it("states the share and the population it was measured over in one line", () => {
    draw(
      "languages",
      ledger({
        [iso(0)]: row({ dictations: 9, languages: { de: 6, en: 1 }, language_refused: 2 }),
      }),
    );

    /* 7 named, 2 refused, 9 asked — and 9 is the day's own dictation count,
       because on the live path there is nowhere else for a run to be. */
    expect(lead()).toBe("2 languages in what you dictated");
    expect(notes()).toContain("mostly German, 86 %");
    expect(notes()).toContain("named on 7 of 9 dictations, 2 being too short to tell");
    expect(screen.queryByText(/Never asked/)).toBeNull();
  });

  /* THE EXCLUSIVE WORD IS NEVER SPENT (ADR 0186). `only German` is a claim about
     every dictation, and this reading has never read every dictation. */
  it("keeps the arithmetic where nothing was refused, and still claims no exclusivity", () => {
    draw("languages", ledger({ [iso(0)]: row({ dictations: 6, languages: { de: 6 } }) }));

    expect(lead()).toBe("1 language in what you dictated");
    expect(notes()).toContain("named on 6 of 6 dictations, 0 being too short to tell");
    expect(notes()).not.toContain("only German");
  });
});

/* THE LEAD IS A MEDIAN AND A COLUMN IS AN AGGREGATE, which are two measurements
   of one voice. A screen that showed both without saying so would be inviting
   the reader to read a difference as a defect — so the chart says which one it
   is, on itself, rather than in a paragraph three blocks away. */
describe("the speaking rate, opened up", () => {
  it("says which statistic the columns are, on the chart", () => {
    const rates = new Array<number>(400).fill(0);
    rates[90] = 4;
    draw("rate", ledger({ [iso(0)]: row() }, { rate_buckets: rates }));

    expect(lead()).toBe("90 wpm while you were actually speaking");
    expect(
      document.querySelector(".ws-chart-title")?.textContent,
    ).toContain("words over its speaking seconds");
  });
});
