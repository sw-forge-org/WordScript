import type { TranscriptionHistoryEntry } from "@/types/history";

/**
 * WHAT THE RECORD CAN ALREADY SAY ABOUT HOW YOU DICTATE.
 *
 * `TranscriptionHistoryEntry` has carried words, a capture clock, insert
 * outcomes and timestamps for a long time and nothing read them. This module is
 * the reading, and it is separate from the screen for one reason: a rate whose
 * denominator quietly skipped half the records is a plausible wrong number, and
 * a plausible wrong number is the failure class this repository keeps a whole
 * track for. It is therefore derived in one place, under test, and every figure
 * it returns carries the count it was computed over.
 *
 * `capture_integrity` IS NULL MORE OFTEN THAN IT LOOKS. It is absent on a retry
 * — which never touched a microphone — and on every record written before the
 * measurement existed. So the figures here are over the records that timed
 * themselves, never over all of them, and the surface says so out loud.
 *
 * NOTHING HERE IS LIFETIME-SCOPED. History is pruned on every read
 * (`history_limit: 200`, `history_retention_days: 90`), so a total built from it
 * grows, sticks at the limit and then runs backwards. Every figure is either a
 * rate — which does not care how many records it saw — or explicitly windowed.
 */

/** The typing speed `timeSavedMinutes` measures against.
 *
 *  IT IS AN ASSUMPTION AND NOT A MEASUREMENT. Nothing in this product has ever
 *  watched the reader type, and nothing will; 40 words a minute is the ordinary
 *  figure for sustained prose typing. That is exactly why the surface renders
 *  the result with `≈` and names the baseline: a number derived from a guess may
 *  be shown, but it may not be dressed as a reading. */
export const TYPING_BASELINE_WPM = 40;

/** Time saved is a rolling window rather than a total, per rule 6. */
export const SAVED_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A record that both said something and timed itself. */
export interface TimedRun {
  words: number;
  seconds: number;
  at: number;
}

/**
 * A figure, and the two counts that say what it is a figure OF.
 *
 * `timed` is how many records the value was computed over; `total` is how many
 * had text to contribute and could have, had they carried a clock. The surface
 * prints both, because `148` over three records and `148` over three hundred are
 * not the same claim.
 */
export interface ActivityReading {
  value: number;
  timed: number;
  total: number;
}

/** The words a record contributes — what was written where the transform ran,
 *  and what was heard where it did not. */
export function wordsIn(entry: TranscriptionHistoryEntry): number {
  const text = entry.transformed_transcript ?? entry.raw_transcript ?? "";
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Every record that could contribute to a rate — i.e. that has words at all.
 *  The denominator of the "N of M" the tiles print. */
export function countableRuns(entries: TranscriptionHistoryEntry[]): number {
  return entries.filter((entry) => wordsIn(entry) > 0).length;
}

/**
 * The records with both halves of a rate.
 *
 * `recorded_seconds` is used whatever the verdict says. The verdict answers
 * whether the capture kept its own clock, which is a question about the RATIO;
 * the seconds are what was actually recorded either way, and the text is a
 * transcript of exactly those seconds. A `short` capture spoke fewer words in
 * fewer seconds and its rate is still its rate.
 */
export function timedRuns(entries: TranscriptionHistoryEntry[]): TimedRun[] {
  const runs: TimedRun[] = [];

  for (const entry of entries) {
    const seconds = entry.capture_integrity?.recorded_seconds;
    if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) continue;
    const words = wordsIn(entry);
    if (words <= 0) continue;
    runs.push({ words, seconds, at: entry.created_at_ms });
  }

  return runs;
}

/**
 * How fast you speak, over the records that timed themselves.
 *
 * TOTAL WORDS OVER TOTAL SECONDS, not the mean of the per-record rates. A mean
 * of rates weights a four-second aside exactly as heavily as a four-minute
 * dictation, and the question the tile asks — how fast do you speak — is about
 * the speech, not about the records.
 *
 * `null` when nothing was measured. There is no zero here: never having been
 * timed is not the same claim as speaking at nought words a minute.
 */
export function wordsPerMinute(entries: TranscriptionHistoryEntry[]): ActivityReading | null {
  const runs = timedRuns(entries);
  if (runs.length === 0) return null;

  const words = runs.reduce((sum, run) => sum + run.words, 0);
  const seconds = runs.reduce((sum, run) => sum + run.seconds, 0);
  if (seconds <= 0) return null;

  return { value: (words / seconds) * 60, timed: runs.length, total: countableRuns(entries) };
}

/**
 * What the last seven days gave back, against the typing baseline.
 *
 * The words would have taken `words / TYPING_BASELINE_WPM` minutes to type; they
 * took `seconds / 60` minutes to say. The difference is the figure, floored at
 * zero — dictating slower than the baseline is possible and "minus four minutes
 * saved" is not a sentence anybody needs on a home screen.
 */
export function timeSavedMinutes(
  entries: TranscriptionHistoryEntry[],
  now = Date.now(),
): ActivityReading | null {
  const since = now - SAVED_WINDOW_DAYS * DAY_MS;
  const window = entries.filter((entry) => entry.created_at_ms >= since);
  const runs = timedRuns(window);
  if (runs.length === 0) return null;

  const words = runs.reduce((sum, run) => sum + run.words, 0);
  const seconds = runs.reduce((sum, run) => sum + run.seconds, 0);
  const typing = words / TYPING_BASELINE_WPM;
  const spoken = seconds / 60;

  return {
    value: Math.max(0, typing - spoken),
    timed: runs.length,
    total: countableRuns(window),
  };
}
