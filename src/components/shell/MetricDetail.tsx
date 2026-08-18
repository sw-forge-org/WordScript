import { useMemo, useState } from "react";
import {
  durationFigure,
  languageLabel,
  ledgerLanguages,
  ledgerMedianTurnaround,
  ledgerMedianWpm,
  ledgerPauseShare,
  ledgerTotals,
  RATE_BUCKET_WPM,
  TURNAROUND_BUCKET_MS,
  type ActivityLedger,
} from "@/lib/activity";
import {
  bestPoint,
  bucketQuantile,
  distributionBars,
  offeredPeriods,
  PERIOD_LABELS,
  rateSeries,
  savedAllTime,
  savedSeries,
  type Period,
  type SeriesPoint,
} from "@/lib/series";
import { Icon } from "./Icon";
import { MetricChart, type ChartBar } from "./MetricChart";
import { SegmentControl } from "./SegmentControl";

/**
 * ONE METRIC, OPENED UP — the third view of the home block (ADR 0235).
 *
 * THE COUNTERS ARE A CHARACTER AND THE CALENDAR IS A RHYTHM, and neither of them
 * can say whether a figure is MOVING. `Time saved` reported 203 minutes over a
 * window the record could only speak three days of, and there was nowhere on the
 * surface to see that the three days were the whole record. This is that place,
 * and it is a view of the same block rather than a panel over it: the calendar
 * proved that a second view of one block is a shape this display already has.
 *
 * EVERY METRIC GETS A CHART AND NOT EVERY METRIC GETS A HISTORY, which is the
 * whole honesty question here. The ledger's day rows carry words and seconds, so
 * time saved and the speaking rate can be walked over days, weeks, months and
 * years. They carry NO turnaround and NO language, which exist only as all-time
 * histograms — so those two draw their spread rather than a history, and say in
 * one line that this is what the record holds. A history invented by spreading
 * an all-time figure evenly over the weeks would be the plausible wrong number
 * this whole track exists to make impossible.
 *
 * THE GRAINS ON OFFER ARE THE ONES THE RECORD CAN FILL, the same rule the year
 * picker follows (ADR 0183). A three-day-old ledger is offered days, the control
 * is not drawn at all, and `Weeks` appears the week it becomes true.
 */

export type MetricKey = "saved" | "rate" | "turnaround" | "languages";

export const METRIC_TITLES: Record<MetricKey, string> = {
  saved: "Time saved",
  rate: "Words per minute",
  turnaround: "Turnaround",
  languages: "Languages",
};

/** A count of minutes as a sentence — `47 minutes`, `3.4 hours`, `5.2 days`. The
 *  same ladder the tile reads on (ADR 0233), so the detail can never disagree
 *  with the counter that opened it. */
export function spellDuration(minutes: number | null): string {
  const figure = durationFigure(minutes);
  if (!figure) return "nothing yet";
  const value = figure.value.toFixed(figure.decimals);
  const unit = value === "1" ? figure.unit.replace(/s$/, "") : figure.unit;
  return `${value} ${unit}`;
}

function Facts({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="ws-metric-facts">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The grain control, drawn only where there is a choice to make. */
function Grain({
  offered,
  period,
  onPeriod,
}: {
  offered: Period[];
  period: Period;
  onPeriod: (next: Period) => void;
}) {
  if (offered.length < 2) return null;
  return (
    <SegmentControl
      className="ws-metric-grain"
      aria-label="Which grain"
      options={offered.map((each) => ({ value: each, label: PERIOD_LABELS[each] }))}
      value={period}
      onChange={onPeriod}
    />
  );
}

function SavedDetail({
  ledger,
  baseline,
  period,
  offered,
  onPeriod,
  now,
}: {
  ledger: ActivityLedger | null;
  baseline: number;
  period: Period;
  offered: Period[];
  onPeriod: (next: Period) => void;
  now: number;
}) {
  const points = useMemo(
    () => savedSeries(ledger, period, baseline, now),
    [ledger, period, baseline, now],
  );
  const drawn = points.reduce((sum, point) => sum + point.value, 0);
  const best = bestPoint(points);
  const allTime = savedAllTime(ledger, baseline);

  const bars: ChartBar[] = points.map((point) => ({
    key: point.key,
    label: point.label,
    value: point.value,
    empty: point.empty,
    hint: point.empty
      ? `${point.full} · nothing credited`
      : `${point.full} · ${spellDuration(point.value)} · ${point.runs} dictations`,
  }));

  return (
    <>
      <Grain offered={offered} period={period} onPeriod={onPeriod} />
      <MetricChart
        bars={bars}
        ariaLabel={`Time saved per ${period}`}
        fallback={`${spellDuration(drawn)} over the ${bars.length} ${period}s drawn`}
      />
      <Facts
        rows={[
          { label: "All time", value: spellDuration(allTime) },
          {
            label: `Best ${period}`,
            value: best ? `${spellDuration(best.value)} · ${best.full}` : "nothing yet",
          },
          { label: "Typing baseline", value: `${baseline} wpm` },
        ]}
      />
      {/* WHAT IS NOT IN THE FIGURE, AND IT BELONGS HERE RATHER THAN IN A HOVER:
          a reader who opened the detail is the reader asking why the number is
          what it is. */}
      <p className="ws-metric-note">
        Your dictated words as typing time, less the time you spent dictating
        them. Agent and Prompt Enhance write prose from an instruction, so their
        output is counted in no figure here.
      </p>
    </>
  );
}

/** The line's own range, in words — a line that does not start at nought has to
 *  say what it does start at.
 *
 *  A RANGE OF ONE FIGURE IS NOT A RANGE. `156 to 156 wpm` is a sentence that
 *  makes a reader look for the difference between its two halves; where the rate
 *  did not move, the reading is the rate. */
function rateRange(points: SeriesPoint[], period: Period): string {
  if (points.length === 0) return "nothing timed yet";
  const low = Math.round(Math.min(...points.map((point) => point.value)));
  const high = Math.round(Math.max(...points.map((point) => point.value)));
  const span = `${points.length} ${period}s`;
  return low === high ? `${high} wpm across ${span}` : `${low} to ${high} wpm over ${span}`;
}

function RateDetail({
  ledger,
  period,
  offered,
  onPeriod,
  now,
}: {
  ledger: ActivityLedger | null;
  period: Period;
  offered: Period[];
  onPeriod: (next: Period) => void;
  now: number;
}) {
  const points = useMemo(() => rateSeries(ledger, period, now), [ledger, period, now]);
  const median = ledgerMedianWpm(ledger);
  const pause = ledgerPauseShare(ledger);
  const measured = points.filter((point) => !point.empty);

  const bars: ChartBar[] = points.map((point) => ({
    key: point.key,
    label: point.label,
    value: point.value,
    empty: point.empty,
    hint: point.empty
      ? `${point.full} · nothing timed`
      : `${point.full} · ${Math.round(point.value)} wpm · ${point.runs} dictations`,
  }));

  return (
    <>
      <Grain offered={offered} period={period} onPeriod={onPeriod} />
      <MetricChart
        bars={bars}
        variant="line"
        ariaLabel={`Speaking rate per ${period}`}
        /* THE RANGE IS THE FALLBACK, because a line that does not start at
           nought has to say what it does start at. */
        fallback={rateRange(measured, period)}
      />
      <Facts
        rows={[
          {
            label: "Median, all time",
            value: median ? `${Math.round(median.value)} wpm` : "nothing yet",
          },
          {
            label: "Thinking pauses",
            value: pause === null ? "not measured" : `${Math.round(pause * 100)} % of the mic`,
          },
          { label: "Runs timed", value: median ? String(median.timed) : "0" },
        ]}
      />
      {/* THE TWO FIGURES ON THIS SCREEN ARE DIFFERENT STATISTICS AND THE READER
          IS TOLD SO. The tile is a median over the all-time histogram; a bucket
          holds no histogram of its own, so a column here is that bucket's words
          over that bucket's speaking seconds — duration-weighted, and a little
          lower wherever a long dictation sits in it. */}
      <p className="ws-metric-note">
        A column is that {period}&apos;s spoken words over its speaking seconds.
        The tile above is the middle dictation of all time, which is a different
        measurement of the same voice.
      </p>
    </>
  );
}

function TurnaroundDetail({ ledger }: { ledger: ActivityLedger | null }) {
  const median = ledgerMedianTurnaround(ledger);
  const p90 = bucketQuantile(ledger?.turnaround_buckets, TURNAROUND_BUCKET_MS, 0.9);
  const runs = (ledger?.turnaround_buckets ?? []).reduce((sum, count) => sum + count, 0);
  const bars = distributionBars(ledger?.turnaround_buckets, TURNAROUND_BUCKET_MS).map(
    (bar) => ({
      key: bar.key,
      label: (bar.from / 1000).toFixed(1),
      value: bar.count,
      marked: median !== null && median >= bar.from && median < bar.to,
      hint: `${(bar.from / 1000).toFixed(1)} to ${(bar.to / 1000).toFixed(1)} s · ${bar.count} dictations`,
    }),
  );

  return (
    <>
      <MetricChart
        bars={bars}
        ariaLabel="How long the wait was, over every dictation"
        fallback={
          runs > 0
            ? `${runs} dictations · seconds from you stopping to the text being ready`
            : "nothing timed yet"
        }
      />
      <Facts
        rows={[
          { label: "Median", value: median === null ? "nothing yet" : `${(median / 1000).toFixed(1)} s` },
          { label: "Nine in ten under", value: p90 === null ? "nothing yet" : `${(p90 / 1000).toFixed(1)} s` },
          { label: "Runs timed", value: String(runs) },
        ]}
      />
      {/* NO HISTORY, AND THE REASON IS THE RECORD RATHER THAN THE SCREEN. */}
      <p className="ws-metric-note">
        The record keeps this one as a spread rather than a history — a day row
        holds no wait. What moves it is the model and the lane, so a change there
        shows up as a second hump before it shows up in the median.
      </p>
    </>
  );
}

function LanguagesDetail({ ledger }: { ledger: ActivityLedger | null }) {
  const languages = ledgerLanguages(ledger);
  const measured = languages.reduce((sum, language) => sum + language.count, 0);
  const dictations = ledgerTotals(ledger).dictations;
  const bars: ChartBar[] = languages.slice(0, 12).map((language) => ({
    key: language.code,
    label: language.code.toUpperCase(),
    value: language.count,
    hint: `${languageLabel(language.code)} · ${language.count} dictations · ${
      measured > 0 ? Math.round((language.count / measured) * 100) : 0
    } %`,
  }));

  return (
    <>
      <MetricChart
        bars={bars}
        ariaLabel="How many dictations came back in each language"
        fallback={
          languages.length > 0
            ? `${languages.length} languages over ${measured} dictations`
            : "nothing measured yet"
        }
      />
      <Facts
        rows={[
          {
            label: "Mostly",
            value: languages.length > 0 ? languageLabel(languages[0].code) : "nothing yet",
          },
          { label: "Named", value: `${measured} of ${dictations}` },
          {
            label: "Too short to name",
            value: String(Math.max(0, dictations - measured)),
          },
        ]}
      />
      <p className="ws-metric-note">
        Measured on the text that came back, never on your language setting. A
        dictation under about eight words is counted in no language at all, which
        is what the second figure is doing there.
      </p>
    </>
  );
}

export function MetricDetail({
  metric,
  ledger,
  baseline,
  onBack,
  /** The moment the series ends at. A prop for the same reason the calendar has
   *  one: a display measured from *now* is a display no test can pin down, and
   *  the bucket a day falls in is exactly what these cases are for. */
  now = Date.now(),
}: {
  metric: MetricKey;
  ledger: ActivityLedger | null;
  baseline: number;
  onBack: () => void;
  now?: number;
}) {
  const offered = useMemo(() => offeredPeriods(ledger, now), [ledger, now]);
  /* WEEKS WHERE THERE ARE WEEKS, AND DAYS UNTIL THEN.
     The first build opened at the COARSEST grain the record could fill, which is
     wrong at both ends: ninety days of record opened on four monthly columns,
     and two years of it would open on two annual ones. A chart with four columns
     is a table with a picture of itself. Weeks fill the plot at every record
     length past a fortnight — thirteen columns at three months, twenty-six at a
     year and after — and *how is my week going* is the question this view is
     opened with. */
  const opening = offered.includes("week") ? "week" : (offered[0] ?? "day");
  const [period, setPeriod] = useState<Period>(opening);
  const grain = offered.includes(period) ? period : opening;

  return (
    <div className="ws-metric">
      <div className="ws-metric-head">
        {/* THE WAY BACK IS A CONTROL AND NOT A GESTURE. The block's own hit area
            swaps to the calendar, so a click on the background here would take
            the reader somewhere they did not ask for; the dots do the same job
            for the view they name. This is the one that returns. */}
        <button type="button" className="ws-metric-back" onClick={onBack}>
          <Icon name="arrow-left" />
          {METRIC_TITLES[metric]}
        </button>
      </div>
      {metric === "saved" && (
        <SavedDetail
          ledger={ledger}
          baseline={baseline}
          period={grain}
          offered={offered}
          onPeriod={setPeriod}
          now={now}
        />
      )}
      {metric === "rate" && (
        <RateDetail
          ledger={ledger}
          period={grain}
          offered={offered}
          onPeriod={setPeriod}
          now={now}
        />
      )}
      {metric === "turnaround" && <TurnaroundDetail ledger={ledger} />}
      {metric === "languages" && <LanguagesDetail ledger={ledger} />}
    </div>
  );
}
