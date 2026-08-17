# 0182: A counter's basis belongs under the figure, and the preview path is not the park

Date: 2026-08-16
Status: Accepted. Twelfth record of the home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)). Finishes what
[ADR 0181](0181-the-wait-starts-when-you-stop-speaking-not-when-the-file-is-already-written.md)
started on the turnaround, and moves two readings out of the hovers ADR 0175 and
ADR 0180 left them in.

## Context

The owner used the counters for an evening and reported three things.

**Turnaround still measured nothing.** ADR 0181 found `turnaround_ms` being
dropped by `history_entry_from_insert_result` and fixed it. On this machine the
tile stayed dark anyway, and the ledger says why: `turnaround_buckets` empty,
`rate_buckets` twelve deep, `languages` at 48. Every one of the fifty stored
records carries `turnaround_ms: null`, including the ones written after the fix
by the running build.

The reason is a second drop, one layer up. A profile that does not auto-paste
never reaches the insert branch at all: the pipeline stages a preview and
returns, and the record is written later by `commit_pending_transcription_preview`
— which passed `None`, with the comment that *the parked path has no turnaround
to report*. That reasoning is sound for a parked overlay and wrong for everything
else that reaches the same function, because **staging a preview is the ordinary
path for clipboard-only delivery, not an exception.** This product already knows
that: Home's own source says 49 of this machine's last 50 dictations were
clipboard deliveries. The measurement existed, sat four lines above the branch,
and was thrown away on the most common path there is.

**The languages tile named its language in a hover.** The foot read
`mostly German · +2`, which counts the others without saying anything about the
first: the same `+2` sits over a record that is nine dictations in ten German and
one that is two thirds. The names and their counts were in the `title`.

**Time saved named its baseline in a hover too.** The baseline is not context
about that figure — it *is* the figure, divided. The same four weeks read 43
minutes at 40 words a minute and 15 at 60 (ADR 0178), and the number doing that
was behind a hover, which is unread standing up and unreachable on a touch
screen.

And the setting behind it was a `Select` of eight bare numbers. It asks the
reader for a figure about themselves that almost nobody has ever measured, and
offers no way to enter the one number somebody who *has* measured it actually
knows.

## Decision

**The preview carries the pipeline's clock to the commit.**
`PendingTranscriptionPreview` gains `turnaround_ms`, set at staging from the same
value the insert branch reports, and both commit branches write it. The interval
between the staging and the commit is *not* added to it: that is how long the
reader took to press a button, and the wait ADR 0181 defines ended when the text
existed.

**A reading goes under the figure; the hover states only what the tile is.**

- Time saved's foot gains a second line, `vs 40 wpm typing`, naming the config's
  own value. Its `title` no longer carries the number.
- Languages' foot reads `mostly German · 86 %` — the top language's share of the
  runs that **were measured**, never of all dictations, because a text too short
  to be sure of is in no bucket at all (ADR 0180) and dividing by the day count
  would drop the share whenever somebody dictates a sentence. One language reads
  `only German`; a share is capped at 99 % while a second language exists, so the
  foot cannot round to a hundred beside a figure that says two. Its `title` no
  longer lists the languages.

**The baseline is asked as a description, and answered as a number if you have
one.** The `Select` becomes three named presets — `Two fingers · 30`,
`Average · 40`, `Touch typist · 70` — beside a field that takes any value from 10
to 200. The field is drafted rather than live, so typing `70` does not put a 7
wpm divisor on disk on the way there, and a hand-entered figure presses no
preset. The control is defined once in `Privacy.tsx` and imported by Onboarding,
the same way `InertSegment` is shared out of `Models.tsx`.

**Onboarding asks for it, on the last step.** Not a step of its own: the flow's
rule is that nothing which fails to block a first dictation earns one, and this
blocks nothing. But it is asked rather than left to a settings screen nobody
visits, because a reader who never chooses gets a figure that looks measured and
is not. Forty stays preselected, so skipping the card is a valid answer. The flow
still writes no config — it has no entry point yet — and the screen's banner
covers that for every control on it.

## Consequences

- Turnaround fills from the next dictation on every delivery mode, including the
  clipboard-only one that is the majority here. The fifty stored records stay
  empty; nothing is backfilled, because nothing measured them.
- The two feet are two lines where they were one. Tiles in the row are top
  aligned, so only the taller tile grows.
- `86 %` and `+2` are different claims about the same ledger, and the ledger did
  not change: no schema bump, no migration.
- A baseline outside 10–200 can no longer be set from the UI. A config that
  already holds one is displayed and is the reader's to correct — the runtime's
  own divisor guard (ADR 0178) is unchanged and still catches a hand-edited file.
