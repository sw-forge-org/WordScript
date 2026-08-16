import { describe, expect, it } from "vitest";
import {
  SAVED_WINDOW_DAYS,
  TYPING_BASELINE_WPM,
  countableRuns,
  timeSavedMinutes,
  timedRuns,
  wordsIn,
  wordsPerMinute,
} from "./activity";
import type { TranscriptionHistoryEntry } from "@/types/history";

/**
 * THE CASE THAT MATTERS MOST HERE IS THE NULL ONE. `capture_integrity` is absent
 * on a retry and on every record older than the measurement, and a rate whose
 * denominator silently skipped those records is a plausible wrong number rather
 * than a missing one. So every figure carries what it was computed over, and
 * these cases assert the counts as hard as they assert the values.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_770_000_000_000;

function entry(overrides: Partial<TranscriptionHistoryEntry> = {}): TranscriptionHistoryEntry {
  return {
    id: "e",
    created_at_ms: NOW,
    status: "completed",
    source: "native_pipeline",
    retry_of: null,
    provider: "groq",
    model: null,
    language: null,
    active_profile: null,
    work_mode: null,
    effective_mode: "cleanup",
    title: null,
    transcript_path: null,
    provider_profile: null,
    local_prompt_strength: null,
    local_prompt_carry: null,
    local_beam_size: null,
    local_best_of: null,
    raw_transcript: null,
    transformed_transcript: null,
    corrected: true,
    applied_rules: [],
    transform_warning: null,
    insert_mode: "direct_paste",
    active_driver: null,
    pasted: true,
    fallback_available: null,
    fallback_reason: null,
    recovery_action: null,
    recovery_message: null,
    clipboard_restore: null,
    error: null,
    audio_path: null,
    fallback_acknowledged: false,
    capture_integrity: null,
    input_level: null,
    ...overrides,
  };
}

/** A record of `words` words that recorded `seconds` seconds of its own clock. */
function timed(words: number, seconds: number, at = NOW): TranscriptionHistoryEntry {
  return entry({
    created_at_ms: at,
    transformed_transcript: Array.from({ length: words }, (_, i) => `w${i}`).join(" "),
    capture_integrity: {
      wall_seconds: seconds,
      recorded_seconds: seconds,
      missing_ratio: 0,
      verdict: "intact",
    },
  });
}

describe("what a record contributes", () => {
  it("counts the written text where the transform ran and the heard text where it did not", () => {
    expect(wordsIn(entry({ transformed_transcript: "one two three", raw_transcript: "x" }))).toBe(3);
    expect(wordsIn(entry({ transformed_transcript: null, raw_transcript: "one  two\nthree" }))).toBe(3);
    expect(wordsIn(entry())).toBe(0);
    expect(wordsIn(entry({ transformed_transcript: "   " }))).toBe(0);
  });

  it("leaves out a record with no clock, and a record with no words", () => {
    const runs = timedRuns([
      timed(10, 5),
      /* A retry: real text, no capture of its own. */
      entry({ transformed_transcript: "some words here", capture_integrity: null }),
      /* A capture that produced nothing. */
      timed(0, 5),
    ]);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toEqual({ words: 10, seconds: 5, at: NOW });
  });

  it("uses the seconds of a short capture too, because the verdict is about the ratio", () => {
    const short = entry({
      transformed_transcript: "one two three four",
      capture_integrity: {
        wall_seconds: 20,
        recorded_seconds: 10,
        missing_ratio: 0.5,
        verdict: "short",
      },
    });
    expect(timedRuns([short])).toHaveLength(1);
    /* The denominator is what was RECORDED, and the text is a transcript of
       exactly those seconds — dividing by the wall clock would report a speaker
       half as fast as they spoke. */
    expect(timedRuns([short])[0].seconds).toBe(10);
  });

  it("counts every record with words as one that could have contributed", () => {
    expect(countableRuns([timed(10, 5), entry({ raw_transcript: "hi" }), entry()])).toBe(2);
  });
});

describe("words per minute", () => {
  it("divides total words by total seconds rather than averaging the rates", () => {
    /* 120 words in 60 s and 20 words in 60 s. The mean of the two rates is 70;
       the rate of the speech is 70 as well only by accident of equal lengths, so
       the case uses unequal ones: 120 words in 30 s (240 wpm) and 20 in 90 s
       (13 wpm) — mean of rates 127, rate of speech 70. */
    const reading = wordsPerMinute([timed(120, 30), timed(20, 90)])!;
    expect(Math.round(reading.value)).toBe(70);
  });

  it("says how many records it was computed over, and how many it could have been", () => {
    const reading = wordsPerMinute([
      timed(100, 60),
      entry({ transformed_transcript: "a retry with no clock" }),
      entry(),
    ])!;
    expect(reading.value).toBe(100);
    expect(reading.timed).toBe(1);
    /* Two records had words; one of them timed itself. */
    expect(reading.total).toBe(2);
  });

  it("is null when nothing timed itself, which is not a rate of zero", () => {
    expect(wordsPerMinute([])).toBeNull();
    expect(wordsPerMinute([entry({ transformed_transcript: "words but no clock" })])).toBeNull();
  });
});

describe("time saved", () => {
  it("measures the words against the typing baseline and subtracts the speaking", () => {
    /* 400 words at 40 wpm is 10 minutes of typing; they were said in 120 s. */
    const reading = timeSavedMinutes([timed(400, 120)], NOW)!;
    expect(TYPING_BASELINE_WPM).toBe(40);
    expect(reading.value).toBeCloseTo(8, 6);
  });

  it("looks at the last seven days and nothing before them", () => {
    const entries = [
      timed(400, 120, NOW - 1 * DAY),
      timed(4000, 1200, NOW - (SAVED_WINDOW_DAYS + 1) * DAY),
    ];
    const reading = timeSavedMinutes(entries, NOW)!;
    expect(reading.timed).toBe(1);
    expect(reading.value).toBeCloseTo(8, 6);
  });

  it("floors at zero rather than reporting negative minutes saved", () => {
    /* 10 words in 120 s: slower than typing them would have been. */
    expect(timeSavedMinutes([timed(10, 120)], NOW)!.value).toBe(0);
  });

  it("is null when the window holds nothing that timed itself", () => {
    expect(timeSavedMinutes([], NOW)).toBeNull();
    expect(timeSavedMinutes([timed(400, 120, NOW - 30 * DAY)], NOW)).toBeNull();
  });
});
