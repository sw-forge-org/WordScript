import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MetricDetail } from "./MetricDetail";
import type { ActivityLedger, LedgerCause, LedgerDay } from "@/lib/activity";

/**
 * THE ONE RULE THIS VIEW CAN BREAK: DRAWING A HISTORY THAT DOES NOT EXIST.
 *
 * The ledger's day rows carry words and seconds, so time saved and the speaking
 * rate can be walked over time. They carry no turnaround and no language — those
 * exist only as all-time histograms — and a chart that spread an all-time figure
 * evenly over the weeks would be the plausible wrong number this whole track is
 * built against. Every case here is that distinction.
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

/** What the facts list says under one label, or `null` where it has no such row.
 *
 *  THE LABEL AND THE FIGURE ASSERTED TOGETHER, which matters more here than it
 *  looks: `getByText("2")` passes on any `2` anywhere on the screen, and this
 *  view draws several. It also stops a case matching a word that happens to
 *  appear in the note underneath — which is how the first version of the split
 *  case below failed, on prose it was not testing. */
function fact(label: string): string | null {
  const terms = Array.from(document.querySelectorAll("dl.ws-metric-facts dt"));
  const term = terms.find((each) => each.textContent?.trim() === label);
  return term?.nextElementSibling?.textContent?.trim() ?? null;
}

function draw(
  metric: Parameters<typeof MetricDetail>[0]["metric"],
  source: ActivityLedger | null,
) {
  return render(
    <MetricDetail metric={metric} ledger={source} baseline={40} onBack={vi.fn()} now={NOW} />,
  );
}

/** One recogniser's row in the ledger's cause map, spelled as waits in
 *  milliseconds rather than as bucket indices — the arithmetic is the thing the
 *  cases are about, so writing it out by hand would hide it.
 *
 *  The model names are invented on purpose: a catalogued id spelled outside
 *  `shared/` fails its own test (ADR 0115), and this list only ever prints what
 *  the ledger holds. */
function cause(provider: string, model: string, waits: number[]): LedgerCause {
  const buckets = new Array<number>(400).fill(0);
  for (const wait of waits) buckets[Math.floor(wait / 25)] += 1;
  return { provider, model, buckets };
}

describe("time saved, opened up", () => {
  it("draws one column per day the record reaches and names the lifetime figure", () => {
    const { container } = draw("saved", ledger({ [iso(0)]: row(), [iso(1)]: row() }));

    expect(container.querySelectorAll(".ws-chart-col")).toHaveLength(2);
    /* 800 words at 40 wpm is twenty minutes of typing, less the four spent
       saying them — and the ladder spells it the way the tile does (ADR 0233). */
    expect(screen.getByText("16 minutes")).toBeInTheDocument();
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
     history beside it, so the case keeps the spread's assertions and swaps the
     two that were about the limit. */
  it("draws turnaround as a spread AND as a history, off two different axes", () => {
    const buckets = new Array<number>(400).fill(0);
    buckets[40] = 6;
    buckets[120] = 2;
    draw("turnaround", ledger({ [iso(60)]: row() }, { turnaround_buckets: buckets }));

    /* THE SPREAD IS UNCHANGED: a median at 1.0 s and a p90 at 3.0 s, off the
       same 25 ms axis the bands are drawn on. */
    expect(screen.getByText("1.0 s")).toBeInTheDocument();
    expect(screen.getByText("3.0 s")).toBeInTheDocument();
    expect(screen.queryByText(/spread rather than a history/)).toBeNull();
  });

  /* A SERIES NEEDS THE ROWS TO CARRY THE FIELD, AND A STAMP SAYING FROM WHEN.
     Without `measured_from` the chart is not drawn at all — which is the rule
     that stops a period predating a field being painted as a zero, and is
     exactly the state every existing installation is in on the day this ships. */
  it("draws no wait history until the rows carry one, and never a zero for the days before", () => {
    const buckets = new Array<number>(400).fill(0);
    buckets[40] = 2;

    /* Rows with a wait but no stamp: the record cannot say from when, so it says
       nothing. */
    draw("turnaround", ledger({ [iso(1)]: row({ turnaround_runs: 2, turnaround_ms_sum: 2000 }) }, { turnaround_buckets: buckets }));
    expect(screen.queryByLabelText(/The middle wait per/)).toBeNull();
  });

  /* WHAT CAUSED IT IS THE QUESTION TURNAROUND IS OPENED WITH (ADR 0236), and
     until ADR 0240 the ledger could not answer it: its histogram was counts per
     25 ms and carried no model, so the list read the history records instead and
     had to admit in its own head that it covered fewer runs than the spread
     above it. The ledger keeps the same distribution per recogniser now — the
     rows sum to the bands, the reach caveat is gone, and the retry and no-clock
     rules moved to the runtime funnel where they are tested once. */
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

    expect(screen.getByText("Which model heard it")).toBeInTheDocument();
    expect(screen.getByText("3 runs all time")).toBeInTheDocument();
    expect(screen.getByText("fast-recogniser")).toBeInTheDocument();
    expect(screen.getByText("2 runs")).toBeInTheDocument();
    /* 1200 ms falls in bucket 48, whose lower edge is 1200 — the same axis the
       bands above are drawn on, which is the point of reading the row off the
       histogram rather than off the raw waits. */
    expect(screen.getByText("1.2 s")).toBeInTheDocument();
    expect(screen.getByText("slow-recogniser")).toBeInTheDocument();
    expect(screen.getByText("5.8 s")).toBeInTheDocument();
    expect(screen.queryByText("never-ran")).toBeNull();

    /* THE VENDOR IS SAID TO BE A VENDOR. `whisper-large-v3-turbo openai` was
       read by the owner as possibly the model's author, possibly the profile;
       one recogniser is served by several vendors at several speeds, which is
       the comparison this list exists for, so the word carries it. Written out
       from the catalogue where it knows the id, and left raw where it does not —
       these ids come off records a later build may have written differently, and
       a row nobody can spell prettily is still a row. */
    expect(screen.getByText("via Groq")).toBeInTheDocument();
    expect(screen.getByText("via vendor-one")).toBeInTheDocument();
  });

  /* A LEDGER WRITTEN BEFORE THE MAP EXISTED STILL DRAWS ITS BANDS. The seed
     fills the causes on the next launch (ADR 0240); until then the block above
     is complete and this one is simply absent, which is the honest shape of *no
     reading* — not a table with no rows. */
  it("draws no cause list where the ledger has no causes", () => {
    const buckets = new Array<number>(400).fill(0);
    buckets[40] = 8;
    draw("turnaround", ledger({ [iso(1)]: row() }, { turnaround_buckets: buckets }));

    expect(screen.queryByText("Which model heard it")).toBeNull();
    expect(screen.queryByText(/runs all time/)).toBeNull();
  });

  /* ADR 0236 REFUSED TO NAME THE CAUSE BECAUSE ONE COUNT COVERED TWO OF THEM,
     and ADR 0243 splits the count instead — which is what makes the label
     sayable. `Not named` became two rows with different futures: one grows with
     every brief dictation, the other is frozen at whatever the index had already
     forgotten. The old case asserted the single row and the refusal to name it;
     both are now the wrong assertion, and this is the record of that. */
  it("splits the unnamed runs into the two populations they have always been", () => {
    draw(
      "languages",
      ledger(
        { [iso(0)]: row({ dictations: 10, languages: { de: 6, en: 1 }, language_refused: 2 }) },
        { languages: { de: 6, en: 1 } },
      ),
    );

    expect(fact("Named")).toBe("7 of 10");
    expect(screen.getByText("German")).toBeInTheDocument();
    /* ASKED AND TOO SHORT — the half a better detector could move. */
    expect(fact("Too short to name")).toBe("2");
    /* NEVER ASKED — 10 counted, 7 named, 2 refused, so one run is left whose
       text the index no longer holds. Derived and never stored, which is why it
       cannot disagree with the row it is derived from. */
    expect(fact("Never asked")).toBe("1");
    expect(fact("Not named")).toBeNull();
  });

  /* AND THE SECOND ROW IS NOT DRAWN AS A ZERO. A record every run of which was
     asked about has nothing to explain, and a `Never asked · 0` would invite the
     reader to wonder what it means — the same rule the marker legend follows. */
  it("says nothing about runs nothing asked about where there are none", () => {
    draw(
      "languages",
      ledger(
        { [iso(0)]: row({ dictations: 8, languages: { de: 6 }, language_refused: 2 }) },
        { languages: { de: 6 } },
      ),
    );

    expect(fact("Too short to name")).toBe("2");
    expect(fact("Never asked")).toBeNull();
    expect(screen.getByText(/Every run this record counted was asked about/)).toBeInTheDocument();
  });
});

/* THE TILE IS A MEDIAN AND A COLUMN IS AN AGGREGATE, which are two measurements
   of one voice. A screen that showed both without saying so would be inviting
   the reader to read a difference as a defect. */
describe("the speaking rate, opened up", () => {
  it("says which statistic the columns are", () => {
    const rates = new Array<number>(400).fill(0);
    rates[90] = 4;
    draw("rate", ledger({ [iso(0)]: row() }, { rate_buckets: rates }));

    expect(screen.getByText(/spoken words over its speaking seconds/)).toBeInTheDocument();
    expect(screen.getByText("90 wpm")).toBeInTheDocument();
  });
});
