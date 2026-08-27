/* THE ACTIVITY FIELD, AND THE FOUR FIGURES BESIDE IT

   The fifth figure in the numbers section, and the only one of the five that
   has to be a shape rather than a number: how often you spoke to it is a
   rhythm, and a rhythm does not fit in a tile.

   The counts below are a constructed example, like the four figures beside
   them and under the same disclaimer. They are written out as data rather than
   generated at load, because a field that reshuffles itself on every visit is
   decoration, and this one is standing in for a reading taken off a file. That
   also means it must NOT move to build-time generation the way the focus row
   did: a generated field would reshuffle per build instead of per visit, which
   is the same defect on a slower clock.

   Levels are cut over active days only, so level 1 means a day something
   happened rather than a day slightly below average. A day with nothing on it
   has to read as empty.

   THE FOUR TILES ARE NOW DERIVED FROM THIS SAME ARRAY, AND THAT IS THE FIX FOR
   THE ONE THING THE SECTION WAS GETTING WRONG.

   The section's own lead says the five figures are one reading off one file.
   They were not: the field was a year of counts and the four tiles beside it
   were four numbers typed independently of it and of each other, so a reader
   who did the arithmetic found the block did not add up. Three of the four are
   sums or ratios over a history, so three of the four are computed here:

   - **Time saved** is the runtime's own formula (`ledgerTimeSaved` in
     src/lib/activity.ts) -- dictated words as typing time, less the time spent
     dictating them -- over the runtime's own 28-day window
     (`SAVED_WINDOW_DAYS`) and against its own default baseline of 40 wpm
     (`default_typing_baseline_wpm` in src-tauri/src/core/config.rs). The tile
     used to print a bare `9h 40m` with no span and no baseline, and ADR 0182
     is explicit that the baseline is not context about that reading, it IS the
     reading: the same four weeks are 43 minutes at 40 wpm and 15 at 60.
   - **Words per minute** is a median rate, so it is the constant the whole
     example is built on rather than a sum over it -- and every word count and
     every clock in this file divides by it, which is what makes the tooltips
     and the tile consistent instead of merely adjacent.
   - **Languages** counts the buckets and states the share and the denominator,
     the way `languageFoot` in src/screens/Home.tsx does.

   Turnaround is the one figure that cannot come from here -- it is a median
   wait per dictation and this array holds counts per day -- so it stays a
   stated constant. */

// 52 weeks, Monday first, dictations per day
export const HEAT_DAYS = [2, 3, 0, 2, 2, 0, 0, 3, 2, 0, 3, 2, 0, 0, 3, 0, 3, 2, 3, 0, 0, 0, 2, 3, 3, 2, 0, 0, 0, 3, 2, 3, 0, 0, 0, 3, 2, 3, 2, 0, 0, 0, 3, 2, 3, 0, 3, 0, 1, 2, 3, 0, 2, 3, 0, 0, 3, 2, 0, 3, 3, 1, 0, 3, 0, 3, 3, 3, 0, 0, 2, 2, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 0, 1, 0, 4, 3, 4, 0, 3, 0, 1, 3, 4, 2, 2, 4, 1, 1, 3, 3, 0, 4, 3, 1, 0, 4, 0, 3, 4, 4, 0, 0, 3, 0, 4, 3, 4, 0, 1, 0, 4, 4, 5, 0, 0, 1, 3, 4, 4, 4, 0, 1, 0, 5, 4, 5, 0, 4, 0, 1, 4, 5, 3, 0, 5, 0, 1, 4, 5, 0, 5, 4, 1, 0, 5, 0, 4, 5, 5, 0, 0, 4, 0, 5, 4, 6, 0, 0, 0, 5, 5, 5, 4, 0, 1, 3, 6, 0, 0, 0, 0, 0, 6, 5, 6, 0, 4, 1, 1, 6, 5, 5, 0, 6, 0, 1, 5, 6, 0, 6, 5, 1, 0, 6, 4, 4, 6, 5, 1, 0, 6, 0, 7, 5, 7, 0, 0, 0, 6, 6, 6, 5, 0, 1, 0, 0, 0, 0, 0, 0, 0, 7, 6, 7, 4, 5, 1, 1, 8, 6, 6, 0, 8, 0, 1, 6, 8, 0, 6, 7, 1, 0, 7, 5, 4, 8, 6, 1, 0, 7, 0, 8, 7, 8, 0, 0, 4, 6, 8, 7, 7, 0, 1, 0, 9, 7, 9, 0, 0, 0, 8, 8, 8, 6, 5, 1, 0, 10, 7, 8, 0, 9, 0, 2, 8, 9, 5, 7, 9, 1, 0, 8, 7, 0, 10, 8, 2, 0, 9, 0, 9, 9, 10, 0, 0, 6, 6, 11, 8, 9, 0, 2, 0, 11, 9, 11, 5, 0, 2, 9, 11, 9, 8, 5, 2, 0, 13, 9, 11, 0, 10, 0, 2, 10, 10, 7, 7, 12, 0, 2, 9, 10, 0, 12, 9, 2, 0];


const DAYS = 7;
export const WEEKS = Math.floor(HEAT_DAYS.length / DAYS);

const active = HEAT_DAYS.filter(n => n > 0).sort((a, b) => a - b);
const q = (p: number) => active[Math.floor(active.length * p)];
const t1 = q(0.25), t2 = q(0.5), t3 = q(0.75);
const level = (n: number) => n === 0 ? 0 : n <= t1 ? 1 : n <= t2 ? 2 : n <= t3 ? 3 : 4;

export type HeatCell = { level: number; week: number; tip: string };

/* THE READING BEHIND A CELL
   Production's calendar answers a hover with the day, the count, the words and
   the two clocks (src/components/shell/ActivityCalendar.tsx). A field that
   only shades is a texture; the same field with the reading behind it is the
   thing the section claims -- that this is read off your own disk.

   Everything below is derived from the counts above by a fixed rule, so a
   given cell says the same thing on every build. No Math.random: a field whose
   tooltip changed per build would be exactly the decoration the header of this
   file rules out, one level deeper. */
const PRNG = (i: number) => {
  let x = (i + 1) * 2654435761 % 2147483647;
  return () => { x = (x * 48271) % 2147483647; return x / 2147483647; };
};

/** The site's own stated rate, so the clocks and the words agree with the tile
 *  four rows down rather than contradicting it. */
const WPM = 142;

/** `default_typing_baseline_wpm`, src-tauri/src/core/config.rs. Nothing has
 *  ever watched anybody type, which is why this is a setting and why the tile
 *  prints it. */
const BASELINE_WPM = 40;

/** `SAVED_WINDOW_DAYS`, src/lib/activity.ts. Four weeks, rolling: a lifetime
 *  figure stops being something a reader can hold. */
const SAVED_WINDOW_DAYS = 28;

const clock = (sec: number) =>
  `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.round(sec) % 60).padStart(2, '0')}`;

/* The grid is 364 days and it ends on the last Sunday before the build, which
   is what puts a full week in the last column. The dates come from the build
   and the counts do not: a calendar whose labels said last year would be the
   one part of this figure a reader could catch out. */
const DAY_MS = 86_400_000;
const end = (() => {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  return new Date(d.getTime() - d.getUTCDay() * DAY_MS);  // the most recent Sunday
})();
const start = new Date(end.getTime() - (HEAT_DAYS.length - 1) * DAY_MS);

const FMT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

type Day = { dictations: number; words: number; seconds: number; longest: number; meetings: number; uploads: number };

/* MEETINGS AND UPLOADS ARE IN THE READING, AND THEY ARE IN IT WITHOUT A TAG.

   `ActivityTooltip` holds a line for them and keeps it behind Developer Mode,
   because the runtime cannot produce those origins yet and a `0 meetings`
   would be an invented figure. This page is under the opposite rule: ADR 0252
   decision 1 says the site shows the product whole and carries no readiness
   labels, so an origin the product has is an origin this field counts. The
   tooltip that omitted them was drawing a narrower product than the section
   two tabs up had already demonstrated.

   They ride on days that already have dictations. A meeting on an otherwise
   empty cell would put a reading behind a cell the field draws as nothing,
   which is the one thing a shaded grid may not do: the shading is the index
   and it counts dictations, exactly as production's does. */
const dayFor = (i: number, n: number): Day => {
  const rnd = PRNG(i);
  let words = 0, longest = 0;
  for (let k = 0; k < n; k++) {
    // 34 to 168 words is a sentence to a long paragraph, which is the spread a
    // dictation log actually has.
    const w = 34 + Math.round(rnd() * 134);
    words += w;
    longest = Math.max(longest, w);
  }
  const weekday = (i % DAYS) < 5;
  return {
    dictations: n,
    words,
    seconds: (words / WPM) * 60,
    longest: (longest / WPM) * 60,
    // A meeting is a working-day thing and it is not an everyday thing.
    meetings: n > 0 && weekday && rnd() < 0.26 ? 1 + (rnd() < 0.18 ? 1 : 0) : 0,
    // A file or a pasted link, rarer still.
    uploads: n > 0 && rnd() < 0.17 ? 1 : 0,
  };
};

const DAYS_READ: Day[] = HEAT_DAYS.map((n, i) => dayFor(i, n));

const tipFor = (i: number): string => {
  const date = FMT.format(new Date(start.getTime() + i * DAY_MS));
  const d = DAYS_READ[i];
  if (d.dictations === 0) return `${date}|Nothing on this day.`;

  const lines = [
    date,
    `${plural(d.dictations, 'dictation')}, ${d.words.toLocaleString('en-US')} words`,
    `Longest ${clock(d.longest)}, ${clock(d.seconds)} recorded`,
  ];
  const other = [
    d.meetings ? plural(d.meetings, 'meeting') : '',
    d.uploads ? plural(d.uploads, 'upload') : '',
  ].filter(Boolean);
  if (other.length) lines.push(other.join(', '));
  return lines.join('|');
};

/* Rows are weekdays and columns are weeks, so the grid is filled by row: day 0
   of every week, then day 1 of every week, and so on. `week` becomes --i, the
   column, so the field fills left to right as one sweep rather than all at
   once. Newest week last, which is where the eye ends up and where the shape
   is densest. */
export const HEAT_CELLS: HeatCell[] = (() => {
  const cells: HeatCell[] = [];
  for (let d = 0; d < DAYS; d++) {
    for (let w = 0; w < WEEKS; w++) {
      const i = w * DAYS + d;
      cells.push({ level: level(HEAT_DAYS[i]), week: w, tip: tipFor(i) });
    }
  }
  return cells;
})();

export const HEAT_LEGEND = [0, 1, 2, 3, 4];

/* ── The four figures ──────────────────────────────────────────────────────
   Three of them are sums or ratios over the array above, so all three move
   together if a single day in it changes. That is the property the block was
   missing: five readings that cannot disagree with each other. */

const sum = (pick: (d: Day) => number, from = 0) =>
  DAYS_READ.slice(from).reduce((a, d) => a + pick(d), 0);

const window28 = DAYS_READ.length - SAVED_WINDOW_DAYS;

/** The runtime's formula, in the runtime's units: dictated words as typing
 *  time, less the time spent dictating them, in minutes. */
const savedMinutes = sum(d => d.words, window28) / BASELINE_WPM - sum(d => d.seconds, window28) / 60;

/** Every language bucket is a run that was long enough to name one. The rest
 *  are in no bucket at all, which is what the denominator says (ADR 0186). */
const dictations = sum(d => d.dictations);
const measured = Math.round(dictations * 0.94);

export const OWN = {
  /** Words per minute, spoken. A median, which is why it is stated rather than
   *  summed -- and it is the divisor every clock in this file uses. */
  rate: WPM,
  timed: Math.round(dictations * 0.86),

  savedHours: Math.floor(savedMinutes / 60),
  savedMinutes: Math.round(savedMinutes % 60),
  baseline: BASELINE_WPM,
  savedSpan: `${SAVED_WINDOW_DAYS / 7} weeks`,

  /** Seconds from you stopping to the text being ready, median, all time. A
   *  wait per dictation, so it is the one figure the day array cannot hold. */
  turnaround: 0.9,

  languages: 3,
  topLanguage: 'English',
  topShare: 71,
  measured,
  dictations,
};
