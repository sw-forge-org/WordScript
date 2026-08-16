# 0175: A tile may only report what the runtime can see, so Apps goes, Turnaround arrives, and the rate is a median

Date: 2026-08-16
Status: Accepted. Fifth record of the home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)). Replaces the `Apps`
tile named in the track's decision 4 and changes how `Words per minute` is
computed; the ledger it reads is
[ADR 0174](0174-all-time-figures-need-a-record-that-does-not-forget-so-the-ledger-is-counts-per-day-and-never-text.md).
Settles the *release until the text exists* figure that decision 6 measured and
sent to the tooltip.

## Context

Two questions from the owner, an hour apart, that turned out to have one answer
between them.

**Is words per minute an average or a median?** It was neither, exactly: total
words over total seconds, which is a *duration-weighted aggregate*. Measured on
fifty real records the three candidates disagreed badly — aggregate **82.7**,
arithmetic mean of the per-run rates **95.3**, median **87.6** — and the reason
they disagree is that both averages are being pulled by different tails.

**Why is `Apps` a problem?** Because the target application is only resolved
where the text is pasted directly. **Forty-nine of this machine's last fifty
dictations were `clipboard_only`**, which has no target to name. The tile was not
unwired; it was unwireable.

The second question generalises, and the owner had already drawn the same line
once when decision 6 cut *time until the text is with you*:

> **A tile may only report what the runtime can observe. Anything downstream of
> the insert is invisible.**

That rules out `Apps`. It also ruled out the first replacement proposed here —
*first time right*, the share of dictations needing no correction — which would
have counted retries and edit-overlay opens and silently missed every time the
reader fixed three words in their own editor. A quality figure that can only see
its own half would have read 94 % while the truth was worse: a plausible wrong
number, produced by the very rule meant to prevent them.

## Decision

### Words per minute is the median run's rate

**An aggregate is dragged down by long dictations.** Runs over a minute carried
81 % of all recorded seconds, and a long dictation is mostly thinking pauses, so
the figure drifts towards the reader's slowest sessions rather than their typical
one.

**A mean is dragged up by short ones.** One two-second capture reported 273 wpm
because the recogniser invented ten words for it. That single run moves a mean of
fifty by nearly four words a minute; it moves a median by nothing.

The median is what a typical dictation actually ran at, which is the only reading
of "how fast do I dictate" a reader can act on.

It is still **throughput and not articulation** — `recorded_seconds` is the open
microphone, so the thinking pause is inside every run's rate. The median makes
the figure typical; it does not make it a speaking rate, and the tooltip says so
in one sentence.

### Apps is replaced by Turnaround

**Median milliseconds from the capture handing over its audio to the text
existing.** Both ends are inside the runtime, so it is the same measurement
whether the text goes to the cursor or to the clipboard — which is exactly what
`Apps` could not manage.

It earns the slot on merit rather than on availability:

- **It is the wait.** The interval where the reader is standing there and nothing
  has happened. At 0.8 s the tool feels instant; at 7 s it feels broken. Nobody
  needs that explained.
- **It is the only tile that answers to a setting.** Words per minute and time
  saved are facts about the speaker and stay flat when the model, the lane or the
  profile changes. This moves immediately, which is what makes it possible to
  tell whether a change helped instead of remembering how last week felt.
- **It was already measured.** `pipeline_started_at` has always run; the runtime
  logged the figure and threw it away. What was missing was a field on the
  record, not a measurement.

Read as a sentence the row is now four distinct axes with none doubled: *this is
how fast you speak, this is what it gives you back, this is how quickly it
answers, in these languages.* `Apps` had been a second reading of reach.

**In milliseconds.** 1210 fills the counter's four reserved positions exactly and
covers 0–9999; whole seconds would turn 1.21 into a `1` and throw the resolution
away. A median again, because one cold start behind a model that had to load is
not what the next dictation will cost.

### A histogram carries every median, and it carries its own axis

A median needs a distribution, and a list of every run's rate would make the
ledger grow with use — the one thing it must not do. So each median is backed by
a **fixed four-hundred-bucket histogram**: one word a minute per bucket for the
rate, twenty-five milliseconds for the turnaround.

**The bucket width is stored in the file.** This is not defensive
over-engineering; it is a bug that shipped and was caught on the running app. A
histogram written at five wpm per bucket and read at one reported a median of
**17** where the truth was **88**, because bucket 17 stopped meaning *85 to 90*
and started meaning *17*. **A histogram without its axis is a plausible wrong
number waiting to happen**, so a width mismatch discards the counts — they are
derived, and the seed rebuilds them.

Each median reports its bucket's **lower edge**, so it never claims a figure
higher than any run actually reached.

### The tile feet name the scope and nothing else

`median · all time`, `≈ minutes · last 4 weeks`, `ms · median · all time`. The
foot used to print `1 of 2 runs timed` beside the figure. That count is a fact
about the measurement rather than about the reader, and on a home screen it is
noise — the *scope* is the part that changes how a number should be read, and it
is the only part that stays. Same cut on the tooltips, which had grown into
paragraphs: one sentence each.

The calendar's line under the grid loses its second half for the same reason. It
had been explaining how far back the record reached, which is a fact about a
settings value that nobody asked a calendar for.

## Consequences

**`Apps` is retired rather than deferred, and the difference matters.** A
`PreviewTag` says *this will read something once the field exists*. `Apps` had no
such future on a clipboard delivery, so leaving it tagged would have been a
promise the product cannot keep. Its test case now asserts the tile's **absence**.

**Turnaround starts empty on an existing installation and that is correct.** The
field is new, so records written before it carry nothing and the seed has nothing
to fold; the tile draws a dark display until the next few dictations fill it. A
dark display asserts nothing, which is exactly the state ADR 0171 built it for.

**`Languages` survives as the one drawn tile**, and it is a genuine deferral
rather than an impossible one: `response.language` already comes back from the
provider and is spent on recogniser repair instead of being written down. That is
Stage B row B1.

**The measurement boundary is now a written rule** and not a series of separate
cuts. It has already decided four things — *time until the text is with you*,
`Apps`, *first time right*, and Turnaround's own definition — and it will decide
the next one the same way: if the reader can act on it after the text leaves, the
runtime cannot see it, and a tile may not claim it.
