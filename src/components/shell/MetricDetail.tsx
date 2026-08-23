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
  type CauseRow,
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
 * EVERY METRIC OPENS ON A SENTENCE, AND THAT IS ADR 0247's CORRECTION. Each of
 * these four used to open on its chart and end in a centred paragraph of
 * six-point prose, with a row of three-word labels in between — `Nine in ten
 * under`, `Measured over`, `Named`, `Mostly`. The reading a person came for was
 * assembled by combining a terse label with a paragraph most readers never
 * reach, and the owner's verdict on it was that nobody works out what they are
 * looking at. So the reading is now stated first, in one line, in words; the
 * qualifiers that used to be a paragraph are one line of clauses under it; and
 * the charts carry their own titles instead of relying on a hover.
 *
 * PROSE IS THE LAST RESORT AND NOT THE FIRST. Anything that can be a label on
 * the thing it describes is a label on the thing it describes — a column header,
 * a chart title, a clause in the lead. What survives as a sentence is what has
 * no object to attach to.
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

/** Milliseconds as the seconds a person waits in — one decimal, the same unit
 *  the tile reads in (ADR 0191). */
function spellWait(milliseconds: number | null): string {
  return milliseconds === null ? "—" : `${(milliseconds / 1000).toFixed(1)} s`;
}

/**
 * THE READING, STATED, BEFORE ANY EVIDENCE FOR IT.
 *
 * One figure, one clause saying what it is a figure OF, and one line of
 * qualifiers under it. It replaces a three-column `<dl>` of terse labels and a
 * centred paragraph, both of which asked the reader to assemble the sentence
 * themselves.
 *
 * THE QUALIFIERS ARE CLAUSES AND NOT SENTENCES. `median of 138 dictations · 9 in
 * 10 under 3.1 s` is read in one pass; the same content as two sentences of
 * prose is read in none. Anything here that cannot survive as a clause did not
 * belong on the surface — it belonged in the ADR.
 */
function Lead({ figure, says, notes }: { figure: string; says: string; notes: string[] }) {
  const carried = notes.filter((note) => note.length > 0);
  return (
    <div className="ws-metric-lead">
      <p className="ws-metric-lead-say">
        <b>{figure}</b> {says}
      </p>
      {carried.length > 0 ? (
        <p className="ws-metric-lead-notes">{carried.join(" · ")}</p>
      ) : null}
    </div>
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

/** Which cut of the same waits the split table is showing. */
type Cut = "model" | "mode";

/**
 * WHERE THE WAIT WENT — one table, two cuts, and the correction ADR 0247 exists
 * for.
 *
 * **THERE USED TO BE TWO TABLES HOLDING ONE NUMBER.** `Which model heard it` and
 * `What the mode cost` sat one under the other, their headings differing in a
 * single letter, and BOTH drew the same end-to-end wait — the ledger filed the
 * whole duration under the recogniser AND under the mode, because a run only
 * ever measured one duration. So a model row said `0.9 s` and a mode row said
 * `0.9 s` and neither number meant what its heading promised: not what the model
 * took, not what the mode cost, but what the dictation took, twice. The owner
 * read it and asked, in order, whether those were total seconds or extracted
 * ones, how long the model took, what the mode cost, which time, and whether the
 * first model was in or out. Every one of those questions was unanswerable from
 * the surface, and four of the five were unanswerable from the record.
 *
 * **THE RUNTIME NOW TAKES TWO READINGS AND THE TABLE STATES BOTH.** `heard in`
 * is the recogniser's own interval and `rewrote in` is the mode's, each read off
 * its own histogram; `in total` is the whole wait, standing beside them so that
 * *are these the total seconds* is answered by the columns rather than by a
 * paragraph. One heading, one toggle, one row per thing — the reader compares
 * within a cut instead of across two blocks that were never comparable.
 *
 * **THE STAGE COLUMN IS ABSENT UNTIL SOMETHING FILLS IT.** No history record
 * ever kept two durations, so a machine with a year of dictation behind it
 * starts with the split measured on none of its runs and fills from the next
 * one. A column of dashes would read as a broken table; no column at all, and a
 * clause saying when it arrives, reads as what it is.
 *
 * **AND THERE IS A THIRD STATE BETWEEN THOSE TWO, WHICH IS WHERE EVERY REAL
 * MACHINE LIVES.** The first build of this table had two: nothing measured, or
 * measured. Rendered against the reporting machine's own ledger the day the
 * runtime learned to split, it drew `heard in 0.5 s` beside `in total 0.9 s`
 * for one recogniser — the first figure over five runs, the second over a
 * hundred and forty-seven, with nothing on the screen saying so and a `title`
 * attribute that says it only on hover. The reader subtracts, and the 0.4 s
 * they get is a difference of two medians over two different populations. So
 * while the split is short of the runs, the count cell carries both figures and
 * the heading names the column that is thin.
 */
function Split({
  ledger,
  runs,
}: {
  ledger: ActivityLedger | null;
  runs: number;
}) {
  const models = useMemo(() => turnaroundCauses(ledger), [ledger]);
  const modes = useMemo(() => modeCauses(ledger), [ledger]);
  const [cut, setCut] = useState<Cut>("model");

  const offered: Cut[] = [
    ...(models.length > 0 ? (["model"] as Cut[]) : []),
    ...(modes.length > 0 ? (["mode"] as Cut[]) : []),
  ];
  if (offered.length === 0) return null;
  /* THE CUT ON OFFER, NOT THE ONE IN STATE. A ledger that loses its mode rows
     between renders — a reset, an import — may not leave the table pointing at a
     cut with nothing in it. Same rule `Grain` follows one component up. */
  const showing = offered.includes(cut) ? cut : offered[0];
  const rows = showing === "model" ? models : modes;
  const covered = rows.reduce((sum, row) => sum + row.runs, 0);
  /* WHETHER THIS CUT HAS ANY SPLIT AT ALL. Asked of the cut rather than of the
     ledger, because the two fill together and a reader looking at one of them
     should not be told about the other's coverage. */
  const staged = rows.reduce((sum, row) => sum + row.staged, 0);
  /* AND WHETHER IT HAS ONE FOR EVERY RUN, WHICH IS A DIFFERENT QUESTION AND THE
     ONE THE FIRST BUILD OF THIS TABLE DID NOT ASK. Between *nothing measured*
     and *everything measured* sits the state every installation is actually in
     for months: a stage column read off a handful of runs standing beside a
     total read off all of them. Drawn without a word, `heard in 0.5 s` beside
     `in total 0.9 s` invites the one subtraction that is wrong twice over —
     medians do not subtract, and these two are not even over the same runs.
     Measured here on the reporting machine the day the split shipped: five runs
     of a hundred and forty-seven. */
  const partial = staged > 0 && staged < covered;

  const name = (row: CauseRow) =>
    showing === "mode"
      ? (PROCESSING_MODE_LABELS[row.key as ProcessingMode] ?? row.key)
      : row.model;

  return (
    <div className="ws-metric-split" data-staged={staged > 0 ? "" : undefined}>
      <div className="ws-metric-split-head">
        {/* THE HEADING ANSWERS *ARE THESE THE SAME RUNS* BEFORE IT IS ASKED. Two
            blocks each ending in their own total read as components of one sum;
            one heading over one toggle says outright that the toggle re-cuts a
            set rather than showing a second one. Where the cut is short of the
            whole — a run whose mode the record never named is in the histogram
            and in no row here — the heading says so in the same breath rather
            than in a footnote under the list. */}
        <p className="ws-metric-split-title">
          {[
            covered === runs
              ? `The same ${runs} ${runs === 1 ? "wait" : "waits"}`
              : `${covered} of the same ${runs} waits`,
            /* THE CLAUSE THAT NAMES WHICH COLUMN IS THIN, and it deletes itself
               the day the split reaches every run — the same self-deleting
               shape as the sentence under the table, one state later. It says
               which column rather than how many rows, because the count per row
               is in the row. */
            ...(partial
              ? [
                  `${showing === "model" ? "heard in" : "rewrote in"} measured on ${staged} so far`,
                ]
              : []),
          ].join(" · ")}
        </p>
        {offered.length > 1 ? (
          <SegmentControl
            className="ws-metric-split-cut"
            aria-label="Which cut"
            options={offered.map((each) => ({
              value: each,
              label: each === "model" ? "by model" : "by mode",
            }))}
            value={showing}
            onChange={setCut}
          />
        ) : null}
      </div>
      {/* THE COLUMN HEADER IS THE WHOLE FIX AND IT COST THREE WORDS. The old
          table had none: a name, a run count and a bare figure in seconds that
          the reader had to guess the meaning of. Naming the columns puts the
          answer where the number is. */}
      <p className="ws-metric-split-row ws-metric-split-columns">
        <span />
        <span>runs</span>
        {staged > 0 ? <span>{showing === "model" ? "heard in" : "rewrote in"}</span> : null}
        <span>in total</span>
      </p>
      <ul>
        {rows.slice(0, 5).map((row) => (
          <li key={row.key} className="ws-metric-split-row">
            {/* `via` IS THE WHOLE FIX FOR THIS CELL, AND IT COST A WORD. The
                first build set the vendor beside the model with nothing between
                them, and the owner read `whisper-large-v3-turbo openai` and
                asked whether that was the model's author, the profile, or the
                vendor. It is the vendor — the same recogniser is served by more
                than one, at different speeds, which is exactly the comparison
                this list is for. */}
            <span className="ws-metric-split-name">
              {name(row)}
              {showing === "model" && row.provider && row.provider !== row.model ? (
                <em>via {vendorName(row.provider)}</em>
              ) : null}
            </span>
            {/* THE ROW'S OWN TWO POPULATIONS, IN THE CELL THAT ALREADY COUNTS
                RUNS. `1/6` says at a glance what a tooltip said only on hover:
                that this row's stage figure is one dictation and its total is
                six. It costs no line of prose — the owner's standing objection
                to this screen was the number of small texts on it — and it
                collapses back to a plain count the moment the split covers the
                row. */}
            <span className="ws-metric-split-runs">
              {staged > 0 && row.staged !== row.runs ? `${row.staged}/${row.runs}` : row.runs}
            </span>
            {staged > 0 ? (
              <span
                className="ws-metric-split-stage"
                title={
                  row.staged === 0
                    ? "Not measured on any of these runs yet."
                    : `Measured on ${row.staged} of ${row.runs}.`
                }
              >
                {spellWait(row.stage)}
              </span>
            ) : null}
            <span className="ws-metric-split-total">{spellWait(row.median)}</span>
          </li>
        ))}
      </ul>
      {rows.length > 5 ? (
        <p className="ws-metric-split-rest">and {rows.length - 5} more</p>
      ) : null}
      {/* THE ONE SENTENCE ON THIS BLOCK, AND IT DELETES ITSELF. Nothing on disk
          can fill the stage column — a history record kept one duration and
          never two — so on any machine with dictation behind it the split starts
          empty and fills from the next run. Saying when a column will appear is
          the alternative to drawing a column of dashes and letting the reader
          decide whether the table is broken. */}
      {staged === 0 ? (
        <p className="ws-metric-split-rest">
          Hearing and rewriting are split from your next dictation onwards — no
          record kept the two apart before now.
        </p>
      ) : null}
    </div>
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
      {/* WHAT IS NOT IN THE FIGURE, CARRIED AS A CLAUSE OF THE FIGURE. It used
          to be the second sentence of a paragraph at the foot of the view, which
          is where a reader arrives after they have already decided what the
          number means. */}
      <Lead
        figure={spellDuration(allTime)}
        says="of typing saved, all time"
        notes={[
          `against typing at ${baseline} wpm`,
          "Draft and Prompt Enhance write their own prose and are counted in none of it",
        ]}
      />
      <Grain offered={offered} period={period} onPeriod={onPeriod} />
      <MetricChart
        bars={bars}
        title={`Saved per ${period}`}
        ariaLabel={`Time saved per ${period}`}
        fallback={
          best
            ? `best ${period} so far: ${spellDuration(best.value)}, ${best.full}`
            : `nothing credited over the ${bars.length} ${period}s drawn`
        }
      />
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
      {/* WHAT THE RATE WAS MEASURED OVER, WHICH IS NOT EVERY DICTATION
          (ADR 0243). The speech clock arrived with ADR 0177 and every run before
          it carries only the open microphone, with no way to re-measure one: the
          audio is not kept. That is a fact about the record rather than a
          defect, and a metric states the population it was measured over. */}
      <Lead
        figure={median ? `${Math.round(median.value)} wpm` : "nothing yet"}
        says="while you were actually speaking"
        notes={[
          `middle of ${totals.voiced} timed dictations`,
          pause === null
            ? ""
            : `${Math.round(pause * 100)} % of your microphone time was pauses, and is left out`,
          totals.voiced < totals.dictations
            ? `${totals.dictations - totals.voiced} older runs cannot be timed — nothing kept their audio`
            : "",
        ]}
      />
      <Grain offered={offered} period={period} onPeriod={onPeriod} />
      {/* THE TITLE SAYS WHICH STATISTIC THE COLUMNS ARE, WHICH USED TO BE A
          SENTENCE UNDERNEATH. The lead is a median over the all-time histogram;
          a bucket holds no histogram of its own, so a column here is that
          bucket's words over its speaking seconds — duration-weighted, and a
          little lower wherever a long dictation sits in it. A reader who never
          compares the two never needs the distinction, and one who does finds it
          on the chart rather than three paragraphs away. */}
      <MetricChart
        bars={bars}
        variant="line"
        title={`Each ${period}'s words over its speaking seconds`}
        ariaLabel={`Speaking rate per ${period}`}
        /* THE RANGE IS THE FALLBACK, because a line that does not start at
           nought has to say what it does start at. */
        fallback={rateRange(measured, period)}
      />
    </>
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
     so the same question every other metric answers is answerable here. It
     starts at the day the field arrived and not at the record's own beginning,
     which is what `measured_from` is for. */
  const points = useMemo(() => turnaroundSeries(ledger, period, now), [ledger, period, now]);
  const drawn = points.filter((point) => !point.empty);
  const seriesBars: ChartBar[] = points.map((point) => ({
    key: point.key,
    label: point.label,
    value: point.value,
    empty: point.empty,
    hint: point.empty
      ? `${point.full} · nothing timed`
      : `${point.full} · median ${spellWait(point.value)} · ${point.runs} dictations${
          point.note ? ` · ${point.note}` : ""
        }`,
  }));

  return (
    <>
      {/* THE WHOLE INTERVAL, NAMED AT BOTH ENDS, IN THE FIRST LINE. It was the
          opening sentence of the paragraph at the bottom of this view, under two
          charts and two tables — which is to say that the definition of the
          measurement stood after every use of it. */}
      <Lead
        figure={spellWait(median)}
        says="from you stopping to the text being ready"
        notes={[
          `middle of ${runs} ${runs === 1 ? "dictation" : "dictations"}`,
          p90 === null ? "" : `9 in 10 came back under ${spellWait(p90)}`,
        ]}
      />
      {seriesBars.length > 0 && (
        <>
          <Grain offered={offered} period={period} onPeriod={onPeriod} />
          <MetricChart
            bars={seriesBars}
            title={`The middle wait per ${period}`}
            ariaLabel={`The middle wait per ${period}`}
            fallback={
              drawn.length > 0
                ? `over the ${drawn.length} ${period}s the record timed`
                : "nothing timed yet"
            }
          />
        </>
      )}
      <MetricChart
        bars={bars}
        title="How long the wait was, over every dictation"
        ariaLabel="How long the wait was, over every dictation"
        fallback={
          runs > 0
            ? `${runs} dictations, in bands of seconds — the lit column holds the middle one`
            : "nothing timed yet"
        }
      />
      <Split ledger={ledger} runs={runs} />
    </>
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
     it. Same shape as the speaking rate's population clause — a metric states
     what it was measured over, and the lifetime dictation count belongs to the
     tiles, where it answers a different question. */
  const refused = totals.language_refused ?? 0;
  const asked = measured + refused;
  const share = measured > 0 && languages.length > 0
    ? Math.min(99, Math.round((languages[0].count / measured) * 100))
    : 0;
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
      {/* THE EXCLUSIVE WORD IS NEVER SPENT HERE (ADR 0186). `only German` is a
          claim about every dictation, and this reading has never read every
          dictation: a text under about eight words is in no language bucket at
          all. Somebody who had dictated in English twice — five words and one —
          was told *only German* and correctly concluded the measurement was
          wrong, when what was wrong was the sentence. The population it was
          measured over stands in the same line as the claim. */}
      <Lead
        figure={String(languages.length || "nothing yet")}
        says={
          languages.length === 1 ? "language in what you dictated" : "languages in what you dictated"
        }
        notes={[
          languages.length > 0 ? `mostly ${languageLabel(languages[0].code)}, ${share} %` : "",
          `named on ${measured} of ${asked} dictations, ${refused} being too short to tell`,
          "read off the text you spoke, never off your language setting",
        ]}
      />
      {seriesBars.length > 0 && (
        <>
          <Grain offered={offered} period={period} onPeriod={onPeriod} />
          <MetricChart
            bars={seriesBars}
            title={`How many were named per ${period}`}
            ariaLabel={`How many dictations were named per ${period}`}
            fallback={`over the ${seriesBars.length} ${period}s the record can speak for`}
          />
        </>
      )}
      <MetricChart
        bars={bars}
        title="Dictations per language, all time"
        ariaLabel="How many dictations came back in each language"
        fallback={
          languages.length > 0
            ? `${languages.length} languages over ${measured} dictations`
            : "nothing measured yet"
        }
      />
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
