import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MetricDetail } from "./MetricDetail";
import type { ActivityLedger, LedgerDay } from "@/lib/activity";

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

function draw(metric: Parameters<typeof MetricDetail>[0]["metric"], source: ActivityLedger | null) {
  return render(
    <MetricDetail metric={metric} ledger={source} baseline={40} onBack={vi.fn()} now={NOW} />,
  );
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

describe("the two metrics the record holds no history for", () => {
  /* THE REASON IS THE RECORD RATHER THAN THE SCREEN, and it is said in words
     under the chart rather than left as an absence the reader has to explain to
     themselves. */
  it("draws turnaround as a spread and offers no grain at all", () => {
    const buckets = new Array<number>(400).fill(0);
    buckets[40] = 6;
    buckets[120] = 2;
    draw("turnaround", ledger({ [iso(60)]: row() }, { turnaround_buckets: buckets }));

    expect(screen.queryByRole("group", { name: "Which grain" })).toBeNull();
    expect(screen.getByText(/spread rather than a history/)).toBeInTheDocument();
    /* A median at 1.0 s and a p90 at 3.0 s, off the same 25 ms axis. */
    expect(screen.getByText("1.0 s")).toBeInTheDocument();
    expect(screen.getByText("3.0 s")).toBeInTheDocument();
  });

  it("counts the dictations no language could be read off, rather than hiding them", () => {
    draw(
      "languages",
      ledger({ [iso(0)]: row({ dictations: 10 }) }, { languages: { de: 6, en: 1 } }),
    );

    expect(screen.getByText("7 of 10")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("German")).toBeInTheDocument();
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
