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
  languageSeries,
  modeCauses,
  turnaroundBands,
  turnaroundCauses,
  turnaroundSeries,
  offeredPeriods,
  PERIOD_LABELS,
  rateSeries,
  savedAllTime,
  savedSeries,
  type Period,
  type SeriesPoint,
} from "@/lib/series";
import { PROCESSING_MODE_LABELS } from "@/lib/transformRules";
import type { ProcessingMode } from "@/types/ipc";
import { CATALOGUE } from "@/lib/modelCatalogue";
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
 * EVERY METRIC GETS A CHART AND, SINCE ADR 0243, A HISTORY. The ledger's rows
 * carry words, seconds, waits and languages, so all four readings walk over
 * days, weeks, months and years — and the coarse grains read the month tier,
 * which is never pruned, so they reach as far back as the installation goes
 * rather than as far as the day rows roll.
 *
 * WHAT MAKES THAT HONEST RATHER THAN INVENTED is that nothing here is spread:
 * every figure a bucket reports was accumulated into a row of that bucket's own
 * period, and a reading younger than the record starts at its own `measured_from`
 * stamp rather than at the record's beginning. A history built by spreading an
 * all-time figure evenly over the weeks would be the plausible wrong number this
 * whole track exists to make impossible, and two of these four used to say so in
 * a line of prose because the rows could not carry them.
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
  const totals = ledgerTotals(ledger);

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
          /* WHAT THE RATE WAS MEASURED OVER, WHICH IS NOT EVERY DICTATION
             (ADR 0243, closing the oldest open item on this track). The speech
             clock arrived with ADR 0177 and every run before it carries only the
             open microphone — 69 runs on the reporting machine, and no way to
             re-measure one: the audio is not kept. That is a fact about the
             record rather than a defect, and the honest thing a surface can do
             about it is say over how much of the record it speaks. */
          {
            label: "Measured over",
            value: `${totals.voiced} of ${totals.dictations}`,
          },
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
        {totals.voiced < totals.dictations
          ? " Dictations from before the speaking clock existed are in neither — nothing kept the audio, so they cannot be measured again."
          : ""}
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
 * IT COVERS EVERYTHING THE HISTOGRAM ABOVE IT DOES, AND THAT IS NEW (ADR 0240).
 * The first build read the history records — the only place a wait and the model
 * that produced it ever sat together — and history was capped at a thousand
 * then, which on the reporting machine was about five days. So a lifetime median
 * stood above a five-day list, the two disagreed by design, and the head had to
 * say so. (The same ADR took that cap to five thousand; the fix is the ledger
 * either way, because any cap is shorter than all time.) The ledger now
 * keeps the same distribution split by recogniser, the rows sum to the bands,
 * and the sentence explaining the discrepancy could go rather than be reworded.
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

function Causes({ ledger }: { ledger: ActivityLedger | null }) {
  const rows = useMemo(() => turnaroundCauses(ledger), [ledger]);
  /* NOTHING WHERE THERE IS NOTHING. `null` is the ledger that has not been read
     yet; an empty map is a machine that has dictated only on builds that never
     recorded a pair. Neither is a table with no rows. */
  const timed = rows.reduce((sum, row) => sum + row.runs, 0);
  if (timed === 0) return null;

  return (
    <div className="ws-metric-causes">
      <p className="ws-metric-causes-head">
        <span>Which model heard it</span>
        <span>
          {timed} {timed === 1 ? "run" : "runs"} all time
        </span>
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

  /* THE HISTORY THIS VIEW SPENT THREE STAGES SAYING IT COULD NOT HAVE
     (ADR 0243). A day row holds a wait now — two counters and a log histogram —
     so the same question every other metric answers is answerable here, and the
     sentence explaining its absence is deleted rather than softened. It starts
     at the day the field arrived and not at the record's own beginning, which
     is what `measured_from` is for. */
  const points = useMemo(() => turnaroundSeries(ledger, period, now), [ledger, period, now]);
  const drawn = points.filter((point) => !point.empty);
  const seriesBars: ChartBar[] = points.map((point) => ({
    key: point.key,
    label: point.label,
    value: point.value,
    empty: point.empty,
    hint: point.empty
      ? `${point.full} · nothing timed`
      : `${point.full} · median ${(point.value / 1000).toFixed(1)} s · ${point.runs} dictations${
          point.note ? ` · ${point.note}` : ""
        }`,
  }));

  return (
    <>
      {seriesBars.length > 0 && (
        <>
          <Grain offered={offered} period={period} onPeriod={onPeriod} />
          <MetricChart
            bars={seriesBars}
            ariaLabel={`The middle wait per ${period}`}
            fallback={
              drawn.length > 0
                ? `the middle wait over the ${drawn.length} ${period}s the record timed`
                : "nothing timed yet"
            }
          />
        </>
      )}
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
      <Causes ledger={ledger} />
      {/* THE MODEL LIST'S TOTAL, COMPUTED HERE RATHER THAN REPORTED UP. A child
          that tells its parent what it drew is a render-time write to a
          sibling's state; the sum is pure and cheap, so the parent takes it. */}
      <Modes
        ledger={ledger}
        against={turnaroundCauses(ledger).reduce((sum, row) => sum + row.runs, 0)}
      />
      {/* THE ONE THING THE LISTS ABOVE CANNOT SAY FOR THEMSELVES (ADR 0182),
          and it is now a smaller claim than it was: the clock stops when the
          TEXT exists, so a mode that rewrites what you said has a second model
          inside the same wait and the MODEL list names only the one that heard
          you. The mode list is the other cut of the same runs, which is what
          makes that difference readable rather than merely disclosed.

          TWO SENTENCES THAT USED TO BE HERE ARE GONE. One apologised for the
          list covering fewer runs than the spread — answered by ADR 0240. One
          said a day row holds no wait — answered by ADR 0243. A sentence
          explaining a limit outlives the limit unless somebody deletes it. */}
      <p className="ws-metric-note">
        The wait runs from you stopping to the text being ready. Where a mode
        rewrote the text, a second model is inside it that the model list does
        not name — which is what the mode list beside it is for.
      </p>
    </>
  );
}

/**
 * THE SAME WAITS, CUT BY THE MODE THAT RAN (ADR 0243).
 *
 * Two one-dimensional cuts of one total and never a cross-tab. This one answers
 * *what does this mode cost me*, which is a question the reader can act on — the
 * model list answers *which recogniser is slow*, which is one they can only
 * change by switching lanes.
 */
function Modes({ ledger, against }: { ledger: ActivityLedger | null; against: number }) {
  const rows = useMemo(() => modeCauses(ledger), [ledger]);
  const timed = rows.reduce((sum, row) => sum + row.runs, 0);
  /* ONE ROW IS NOT A COMPARISON. A reader who has only ever run one mode learns
     nothing from a list of it, and the figure is already the median above —
     which is the same argument `Grain` makes about a control with one option. */
  if (timed === 0 || rows.length < 2) return null;

  return (
    <div className="ws-metric-causes">
      {/* THE ONE THING THE READER ASKED FOR (ADR 0244). Two blocks with the
          same shape, each ending in a total, read as components of one — the
          owner asked outright whether these add up or are already split. They
          are the SAME runs cut a second way, and the heading is where that
          belongs; a sentence under the second list arrives after the question
          has already been answered wrongly.

          A RUN WITH NO NAMED MODE IS COUNTED IN THE HISTOGRAM AND IN NO ROW
          HERE, so this cut can be short of the other one. That used to be
          disclosed only in a source comment claiming the surface stated it. */}
      <p className="ws-metric-causes-head">
        <span>What the mode cost</span>
        <span>
          {timed === against
            ? `the same ${timed} ${timed === 1 ? "run" : "runs"}`
            : `${timed} of the same ${against} ${against === 1 ? "run" : "runs"}`}
        </span>
      </p>
      <ul>
        {rows.slice(0, 5).map((row) => (
          <li key={row.key}>
            <span className="ws-metric-cause-name">{PROCESSING_MODE_LABELS[row.key as ProcessingMode] ?? row.key}</span>
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

function LanguagesDetail({
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
  const languages = ledgerLanguages(ledger);
  const measured = languages.reduce((sum, language) => sum + language.count, 0);
  const totals = ledgerTotals(ledger);
  /* ONE SOURCE FOR EVERY FIGURE ON THIS SCREEN (ADR 0244), and the reason it is
     spelled out: it used to be two. The chart read a lifetime map, the rows
     under it read the tiers, and the three numbers summed to 653 against 586
     dictations — a plausible wrong number produced by the record written to
     prevent them.

     `asked` IS THE DENOMINATOR AND NOT THE DICTATION COUNT. The runtime
     increments exactly one of these two on every counted run, so their sum is
     the population a language was asked of and the two rows always account for
     it. Same shape as the speaking rate's `Measured over: n of m` — a metric
     states the population it was measured over, and the lifetime dictation
     count belongs to the tiles, where it answers a different question. */
  const refused = totals.language_refused ?? 0;
  const asked = measured + refused;
  const points = useMemo(() => languageSeries(ledger, period, now), [ledger, period, now]);
  const seriesBars: ChartBar[] = points.map((point) => ({
    key: point.key,
    label: point.label,
    value: point.value,
    empty: point.empty,
    hint: `${point.full} · ${point.note ?? "nothing dictated"}`,
  }));
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
      {seriesBars.length > 0 && (
        <>
          <Grain offered={offered} period={period} onPeriod={onPeriod} />
          <MetricChart
            bars={seriesBars}
            ariaLabel={`How many dictations were named per ${period}`}
            fallback={`what was named over the ${seriesBars.length} ${period}s the record can speak for`}
          />
        </>
      )}
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
          { label: "Named", value: `${measured} of ${asked}` },
          { label: "Too short to name", value: String(refused) },
        ]}
      />
      {/* A THIRD ROW STOOD HERE AND IT IS GONE (ADR 0244). *Never asked* was
          sold as the runs from before the record kept an answer; it actually
          measured how far back the SEED could reach, was non-zero on exactly
          one machine in the world, and is structurally zero on every
          installation from here on — every counted run increments one of the
          two rows above. */}
      <p className="ws-metric-note">
        Measured on the text you spoke, never on your language setting.{" "}
        <em>Too short to name</em> was asked and came back empty, and it moves
        with every brief dictation.
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
      {metric === "turnaround" && (
        <TurnaroundDetail
          ledger={ledger}
          period={grain}
          offered={offered}
          onPeriod={setPeriod}
          now={now}
        />
      )}
      {metric === "languages" && (
        <LanguagesDetail
          ledger={ledger}
          period={grain}
          offered={offered}
          onPeriod={setPeriod}
          now={now}
        />
      )}
    </div>
  );
}
