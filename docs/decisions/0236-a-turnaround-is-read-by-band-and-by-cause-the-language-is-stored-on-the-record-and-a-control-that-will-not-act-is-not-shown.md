# 0236 - A turnaround is read by band and by cause, the language is stored on the record, and a control that will not act is not shown

Date: 2026-08-18
Status: Accepted. Four reports back from
[ADR 0235](0235-a-metric-opens-its-own-view-of-the-home-block-and-it-draws-only-what-its-record-can-carry.md),
read on the owner's own machine the day it landed. Amends the point geometry of
[ADR 0191](0191-a-counter-with-ten-glyphs-gets-a-decimal-point-by-widening-a-gap-it-already-has.md),
stores the answer
[ADR 0188](0188-one-call-names-the-file-and-the-language-and-it-stands-behind-the-insert.md)
reaches, and finishes the view lock ADR 0235 opened.

## Context

The metric views went in and were read against 447 real dictations. Four things
came back, and none of them is a preference.

**1. The turnaround chart asked no question.**

> bei der Metrik […] Turnaround ist es UX-technisch extrem unübersichtlich, weil
> der User checkt nicht ganz, ja was genau ist damit gemeint. […] 4,5 Sekunden
> to 4,9 Sekunden, 3 Dictations und dann gibt es das gleiche mal mit 0
> Dictations. Was will man damit anfangen ist die Frage.

Measured on the ledger behind that screen: 346 timed runs spread over 379
buckets of 25 ms, drawn as 24 columns of 400 ms of which **11 were empty**, with
a single 9.975 s run holding the axis open across all of them. Every column's
read-out was a sentence of the form *this many dictations came back between
these two nearly identical times*, which nobody asks and nothing follows from.

**2. `Too short to name · 91 runs` was the wrong sentence about the right
number.**

> Aber bei Languages steht Too short to name 91 runs all time. Aber wie kann das
> sein? Wir hatten doch deterministische Language Detection und AI Model
> Language Detection mit reingepackt.

He is right that both instruments exist, and the count is real: 447 dictations,
356 named, 91 in no bucket. The naming call works — the runtime log for the same
period holds 75 naming lines, 74 of which came back with a language (67 `de`, 6
`en`, 1 `nl`). **Nothing stored any of them.** `contributed_language` was
computed inside the ledger write and thrown away with it, so
`activity_ledger::seed_from_history` — which re-folds the ledger from history
whenever the file is missing or has been reset — had no model answer to pass and
re-measured with the offline detector alone. That detector refuses under eight
words or twenty characters
([ADR 0180](0180-the-lane-that-most-dictations-take-never-names-a-language-so-the-language-is-measured-on-the-text.md)),
and 54 of the 389 records still on disk are under it against 17 under the naming
floor. The 91 is mostly not *too short to name*; it is *named, and not written
down*.

**3. A decimal point merged into the digit before it.**

> bei der Metrik TimeSaved fehlt ein Pixel Padding zwischen der 3 und dem Punkt,
> genauso wie bei der Metrik Turnaround — da ist es schon richtig gemacht.

Two tiles, one component, one code path, and one of them correct. ADR 0191 left
the point hard against the digit on its left and argued that this is where a
decimal point belongs. The argument was about printed type, which has side
bearings; these glyphs have none. **Seven of the ten reach their last column in
the two rows the mark occupies** — `0`, `2`, `3`, `5`, `6`, `8`, `9` do, and `1`,
`4`, `7` do not — so `1.0` was clean and `3.5` was one shape, on the same
display, at the same moment.

**4. The dots kept offering a view the block would not go to.** First:

> Und wenn ich auf irgendeiner Metric Ansicht bin, dann soll verhindert werden,
> dass ich von dieser reingesummten Metric Ansicht nochmal auf die Kalender
> Ansicht switchen kann.

They were disabled. That was half an answer:

> auf jeder vergrößerten Metric-Ansicht gibt es unten immer noch diese zwei
> Punkte, die vorgeben, man könnte noch zur Kalender-Ansicht switchen. Das
> heißt, mechanisch ist es ausgeschaltet, aber visuell ist es noch da.

A lit dot with an unlit twin beside it reads as a choice whatever `disabled`
says about it.

**And one more, once the cause list existed.** The list was asked for in the
same round —

> Es würde noch Sinn machen, wenn man beim Turnaround irgendwie das AI-Model
> sieht, das dafür hauptverantwortlich war […] weil das ist ja der Sinn vom
> Turnaround.

— and its first build printed the vendor beside the model with nothing between
them:

> Allerdings steht bei Whisper Large V3 Turbo OpenAI. Jetzt ist die Frage, ist
> das wirklich ein OpenAI Model oder ist das… das Profil oder was ist das? Oder
> ist das der Model Provider?

It is the vendor, and the ambiguity is not academic: on this machine the same
recogniser appears twice, at 1.0 s over 261 runs through one vendor and at 5.8 s
over one run through another. That contrast is the entire reason the list is
there, and an unlabelled second word hides it.

## Decision

**1. Turnaround is read in five bands, not in a histogram.** The edge set is
picked from the record's own p90 out of three — sub-second, ordinary, slow — so
a fast machine is not four empty columns and a slow one is not one full column.
Four closed bands and one open top band; trailing empty bands are dropped and
interior ones kept, because a gap between two occupied bands is a fact and a
tail of noughts is furniture. Each band's hint carries its **share**, which is
what a wait is actually read for: *under a second, seven times in ten*.

**2. Under the bands, what caused it.** The ledger's histogram is counts per
25 ms and carries no model, so the list reads the history records instead:
grouped by vendor and model, sorted by runs, each row carrying its own median.
The vendor is written out from `shared/model_catalogue.json`
([ADR 0115](0115-a-model-name-is-a-dated-row-in-one-catalogue-and-neither-runtime-spells-it-alone.md))
and prefixed **`via`**, and an id the catalogue has never heard of prints raw
rather than throwing — these ids come off records an older build may have
written differently, and a row nobody can spell prettily is still a row.

**3. The record stores the language it was counted as.** A new additive
`spoken_language` on `TranscriptionHistoryEntry`, decided **once** in
`record_entry_with_work_mode` through the same `contributed_language` the ledger
write used, read from there by the ledger write and by the seed. The seed falls
back to re-measuring for records written before the field, which is the best
that can be done for them. The tile's label becomes **`Not named`**, because
*too short* was only ever one of the two reasons and the other one was ours.

**4. The decimal gap is four columns with the mark in the middle two.** One
clear column on each side, so the mark cannot touch a glyph whatever glyph
stands there. It is the only arrangement that does not depend on the data, and
not depending on the data is the whole property a counter needs.

**5. The view dots are hidden while a metric is open, not disabled.**
`visibility` rather than unmounting, because the row is the last thing on the
block and removing it would lift the chart being read by its own height on a
swap nobody made; `disabled` keeps them out of the tab order and `aria-hidden`
keeps the reader who cannot see them from being offered what the reader who can
see them is not.

## Consequences

- **The 91 is not repaired.** Nothing can recover an answer that was never
  written down; the field only stops the next rebuild from losing the next one.
  The tile will say `Not named` for those records for as long as they exist.
- **The record grows one optional string** and no migration: `#[serde(default)]`
  reads every existing `history.json` unchanged, and the frontend type marks it
  optional for the same reason.
- **The cause list is the only reading on Home that is not all-time**, and it
  says so: history is pruned by age and count while the ledger is not, so its
  run total is lower than the spread above it by design.
- **The wait it charges to a model is not always all that model's.** The clock
  stops when the *text* exists
  ([ADR 0181](0181-the-wait-starts-when-you-stop-speaking-not-when-the-file-is-already-written.md)),
  so a mode that rewrites what was said has a second model inside the same
  interval, and the record names only the one that heard you. The note under the
  list states it rather than leaving the reader to discover it
  ([ADR 0182](0182-a-counters-basis-belongs-under-the-figure-and-the-preview-path-is-not-the-park.md)).
- **A counter with a point is three columns wider than one without**, inside a
  grid track that has the room. A counter nobody can read correctly is not worth
  eighteen pixels.
- **Grouping by profile was considered and dropped.** Only one delivery mode is
  in use per profile on this machine, so a profile split would have compared
  delivery modes while claiming to compare profiles. The model is the honest cut
  today; a mode split is the next one available, since `effective_mode` is on
  every record already.
