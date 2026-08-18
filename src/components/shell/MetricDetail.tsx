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
  turnaroundBands,
  turnaroundCauses,
  offeredPeriods,
  PERIOD_LABELS,
  rateSeries,
  savedAllTime,
  savedSeries,
  type Period,
  type SeriesPoint,
} from "@/lib/series";
import { CATALOGUE } from "@/lib/modelCatalogue";
import { Icon } from "./Icon";
import type { TranscriptionHistoryEntry } from "@/types/history";
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

/**
 * WHERE THE WAIT CAME FROM — the one thing on this view that answers *why*.
 *
 * The owner's argument, and it is the right one: a spread tells you the wait is
 * two seconds and leaves you there. **The reason anybody opens turnaround is to
 * find out what is making it that.** The record can answer it per model, and the
 * answer on this machine is worth the block on its own — one dictation on a
 * second vendor took 5.8 s and is the whole tail the bands above end in.
 *
 * IT COVERS LESS THAN EVERY FIGURE ABOVE IT AND SAYS SO IN ITS OWN HEAD. The
 * histogram is all-time; these are the records still on the machine, which
 * pruning by age and by count keeps shorter. Two numbers that must differ, with
 * the reason written where they meet (ADR 0172).
 */
/**
 * A VENDOR'S WRITTEN NAME, and the raw id where the catalogue has never heard
 * of it.
 *
 * `providerLabel` throws on an unknown id, which is right where a lane is being
 * configured and wrong here: this reads ids off records that are already on
 * disk, including ones written by a build that named its providers differently.
 * A row that cannot be spelled prettily is still a row worth showing.
 */
function vendorName(id: string): string {
  return CATALOGUE.providers.find((entry) => entry.id === id)?.label ?? id;
}

function Causes({ records }: { records?: TranscriptionHistoryEntry[] }) {
  const rows = useMemo(() => turnaroundCauses(records), [records]);
  /* NOTHING WHILE IT IS LOADING, AND NOTHING WHERE THERE IS NOTHING. `undefined`
     is the read that has not come back yet; an empty list is a machine whose
     remaining records carry no wait. Neither is a table with no rows. */
  if (records === undefined) return null;
  const timed = rows.reduce((sum, row) => sum + row.runs, 0);
  if (timed === 0) return null;

  return (
    <div className="ws-metric-causes">
      <p className="ws-metric-causes-head">
        <span>Which model heard it</span>
        <span>{timed} records still on this machine</span>
      </p>
      <ul>
        {rows.slice(0, 5).map((row) => (
          <li key={row.key}>
            {/* `via` IS THE WHOLE FIX, AND IT COST A WORD. The first build set
                the vendor beside the model with nothing between them, and the
                owner read `whisper-large-v3-turbo openai` and asked whether that
                was the model's author, the profile, or the vendor. It is the
                vendor — the same recogniser is served by more than one, at
                different speeds, which is exactly the comparison this list is
                for — and an unlabelled second word could be any of the three. */}
            <span className="ws-metric-cause-name">
              {row.model}
              {row.provider && row.provider !== row.model ? (
                <em>via {vendorName(row.provider)}</em>
              ) : null}
            </span>
            <span className="ws-metric-cause-runs">
              {row.runs} {row.runs === 1 ? "run" : "runs"}
            </span>
            <span className="ws-metric-cause-wait">{(row.median / 1000).toFixed(1)} s</span>
          </li>
        ))}
      </ul>
      {rows.length > 5 ? (
        <p className="ws-metric-causes-rest">and {rows.length - 5} more</p>
      ) : null}
    </div>
  );
}

function TurnaroundDetail({
  ledger,
  records,
}: {
  ledger: ActivityLedger | null;
  records?: TranscriptionHistoryEntry[];
}) {
  const median = ledgerMedianTurnaround(ledger);
  const p90 = bucketQuantile(ledger?.turnaround_buckets, TURNAROUND_BUCKET_MS, 0.9);
  const runs = (ledger?.turnaround_buckets ?? []).reduce((sum, count) => sum + count, 0);
  /* FIVE BANDS, NOT A HISTOGRAM, AND THE OWNER IS WHY. The fine one drew this
     machine's 346 runs as twenty-four columns of which eleven were empty, and
     the read-out under the cursor said `4.5 to 4.9 seconds · 3 dictations` — a
     sentence with no question behind it. A band carries its share, which is the
     thing a wait is actually read for: *under a second, half the time*. */
  const bars = turnaroundBands(ledger?.turnaround_buckets, TURNAROUND_BUCKET_MS).map(
    (band) => ({
      key: band.key,
      label: band.label,
      value: band.count,
      marked:
        median !== null && median >= band.from && (band.to === null || median < band.to),
      hint: `${band.count} ${band.count === 1 ? "dictation" : "dictations"} came back ${
        band.spoken
      } · ${Math.round(band.share * 100)} %`,
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
      <Causes records={records} />
      {/* NO HISTORY, AND THE REASON IS THE RECORD RATHER THAN THE SCREEN — plus
          the one thing the list above cannot say for itself (ADR 0182). The
          clock stops when the TEXT exists, so a mode that rewrites what you said
          has a second model inside the same wait, and the record names only the
          one that heard you. The row is still where the wait is charged; it is
          not always where all of it was spent. */}
      <p className="ws-metric-note">
        The ledger keeps this one as a spread rather than a history — a day row
        holds no wait — so the list above reads the records themselves, which
        pruning keeps shorter than the spread. The wait runs from you stopping to
        the text being ready, so where a mode rewrote the text a second model is
        inside it that the record does not name.
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
            /* NOT `Too short to name`, WHICH NAMED A REASON THE RECORD CANNOT
               VOUCH FOR. Some of these runs were short. Others are the ones the
               ledger was folded from before it existed, where nothing had asked
               a model and the offline detector's eight-word floor decided alone.
               The count is one number covering two causes, so it states the
               fact and the note carries both (ADR 0161, ADR 0236). */
            label: "Not named",
            value: String(Math.max(0, dictations - measured)),
          },
        ]}
      />
      <p className="ws-metric-note">
        Measured on the text you spoke, never on your language setting. A run
        goes unnamed where it was too short to read a language off — and where
        the ledger was folded from records that never stored one, which is every
        dictation from before it started counting. Nothing goes back over them.
      </p>
    </>
  );
}

export function MetricDetail({
  metric,
  ledger,
  records,
  baseline,
  onBack,
  /** The moment the series ends at. A prop for the same reason the calendar has
   *  one: a display measured from *now* is a display no test can pin down, and
   *  the bucket a day falls in is exactly what these cases are for. */
  now = Date.now(),
}: {
  metric: MetricKey;
  ledger: ActivityLedger | null;
  /** The history records, for the one reading the ledger cannot produce: which
   *  model each wait came from. `undefined` until the read comes back, and the
   *  block that uses it draws nothing until then — it is the only prop on this
   *  view that is not all-time, so only the view that needs it is given it. */
  records?: TranscriptionHistoryEntry[];
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
      {metric === "turnaround" && <TurnaroundDetail ledger={ledger} records={records} />}
      {metric === "languages" && <LanguagesDetail ledger={ledger} />}
    </div>
  );
}
