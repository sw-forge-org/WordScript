# 0178: Time saved may only credit what somebody would have typed, and the baseline is the reader's to set

Date: 2026-08-16
Status: Accepted. Eighth record of the home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)). Replaces the
constant `TYPING_BASELINE_WPM` in `src/lib/activity.ts` with
`config.typing_baseline_wpm`, and changes which runs the figure is computed over.

## Context

The owner asked how accurate *Time saved* actually is, which typing speed it
assumes, and said the tooltip ought to explain it. Reading the derivation found
three separate problems, one of which is larger than the rest combined.

**The baseline is the figure.** `words / 40 − seconds / 60`. Forty words a minute
is the ordinary figure for sustained prose typing and it is a guess: nothing in
this product has ever watched anybody type. Measured on four weeks of the
reporting machine's own records, the same dictations read **43 minutes saved at
40 wpm** and **15 at 60** — a threefold swing on the one input that was never
measured, hard-coded, and never shown. Somebody who writes all day is faster than
the ordinary figure; somebody dictating into a phone is slower. Neither could say
so.

**A generated essay was being credited as typing avoided.** The numerator was the
DELIVERED text. Under Agent and Prompt Enhance a model writes two hundred words
from fifteen spoken ones — words nobody dictated and nobody would have typed
either. At 40 wpm each such run credited five minutes of "saving" that never
existed.

**The numerator and the denominator came from different sets of runs.** A day's
`words` counted every dictation; its `recorded_seconds` counted only the runs
that carried a capture clock. So a day holding one untimed record credited that
record's words against no time at all. Small in ordinary use — every native
dictation carries the clock — and structurally wrong, which is the class of
defect this track exists to remove.

## Decision

### The runtime writes the credited runs as one group

`LedgerDay` gains `saved_runs`, `saved_words` and `saved_seconds`. A run is
written into all three or into none. It is credited when it carried a capture
clock **and** its mode does not generate text — `mode_credits_typing` returns
false for exactly `Agent` and `PromptEnhance`.

Translate is credited: a translation is still the reader's own sentence and they
would have had to produce it somehow.

**The words and the seconds now come from the same runs by construction**, so
there is no arrangement of records that can divide one set by another. The tile
reads `saved_words / baseline − saved_seconds / 60` and states `saved_runs` as
what it was computed over.

### The cost side stays the open microphone

`saved_seconds` is `recorded_seconds` and deliberately not the speech clock that
[ADR 0177](0177-a-rate-that-counts-a-models-words-over-an-open-microphone-is-not-a-speaking-rate.md)
introduced, which looks inconsistent beside the rate and is not: **the thinking
pause was your time too.** You spent it. The rate asks how fast you speak; this
asks what the dictation cost. Two different questions about the same minute, and
each takes the denominator that answers it.

The turnaround wait is not in the cost side. At a median near a second per run it
is under a percent of the figure, and adding it would put a latency into a tile
about typing.

### The baseline is a setting

`config.typing_baseline_wpm`, default 40, clamped to 10..200 in
`normalize_for_runtime` because it is a DIVISOR — a config hand-edited to zero
would make every minute of dictation save an infinity. Privacy & Data draws it
under *Activity figures*, next to the reset that clears the same tile's history.

The tooltip names the value it used and where to change it, in one sentence. The
`≈` stays: a number derived from an assumption may be shown, but it may not be
dressed as a reading.

## Consequences

- The figure is smaller and true for readers who type quickly, and larger and
  true for readers who do not.
- A day of Prompt Enhance contributes its words to the record and nothing to this
  tile.
- The four-week window is unchanged (ADR 0174's rule 6, the owner's call): a
  lifetime "time saved" stops being something a reader can hold.
- Records that predate the credited fields are folded in from whatever history
  still holds, once — otherwise an existing installation would read nothing here
  until four weeks of new dictation had accumulated.
