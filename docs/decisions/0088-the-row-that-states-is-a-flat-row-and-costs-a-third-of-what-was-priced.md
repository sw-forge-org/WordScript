# 0088: The row that states is a flat row, and costs a third of what was priced

Date: 2026-08-11
Status: Accepted

## Context

ADR 0087 decided that Titles belongs on AI Models' job list, ruled that the row
**states rather than sets**, and deliberately did not draw it. It handed the
next leg a measured cost:

> A ninth job row was added and `npm run port:diff` run against it: `models`
> goes from **structural 0 | style 0** to **structural 18 | style 6** [...]
> the expectation for `port:diff` drops from 25 of 25 to 24 of 25 with `models`
> named as the departure.

The row is drawn here. The expectation moved exactly as predicted -- **24 of 25,
with `models` named** -- and the number attached to it did not.

**The eighteen was measured against a different row.** ADR 0087's trial built
the ninth row the way the eight above it are built, as a `LaneJobRow`: a
`<details>` with a chevron, a summary, a model badge, and a `Follows` body of
override rows. That row renders `details.job`, which is the same element
signature as every job row around it, so inserting it moved every sibling index
after it -- ADR 0082's mechanic, and the reason the figure was eighteen rather
than the six nodes the row itself adds.

**But a `LaneJobRow` contradicts the decision it was measuring.** ADR 0087 says
the row adds no setting, because ADR 0077 resolves the model through
`chat_model_for_provider`. A `<details>` whose body holds no control is an
affordance that opens nothing -- the fake affordance rule 7 forbids, and the
same defect DESIGN_SYSTEM.md records against the sidebar's search field and Help
row, which were ported in Leg 2 and deliberately left unmounted for three legs
until there was something behind them.

So the shape that carries ADR 0087's decision honestly is the one that does not
open, and its cost had never been measured.

## Decision

**Titles is a flat `JobNone` row, last in the Writing group, and it costs
`models` structural 6 | style 6.**

- **It does not open, and that is the decision rather than an economy.** The row
  names the job, says what it does, and states which model runs it. There is no
  chevron because there is nothing behind one.
- **`JobNone` gains a third case and keeps its name.** It was "a mode that runs
  no model" and "a job this lane cannot run"; Titles is "a job that runs one it
  does not choose". What the three share is not the absence of a model, it is
  the absence of anything to open -- which is what the component was always
  drawing.
- **It sits in Writing, not in `Runs no model`.** It runs a model. The fourth
  group exists to state the modes that do not, and putting a row there that
  spends a call on every dictation would answer the screen's question with the
  opposite of the truth.
- **The control names the owner, not a second model.** `Runs the assistant's
  model` follows the precedent Auto already set in the fourth group (`Routes
  with Cleanup's model`): a job that runs on another job's model says whose, and
  does not draw a picker for a choice the runtime does not read.
- **The `what` line carries the cost, because the cost is the point.** ADR 0077
  named "one extra model call per dictation" as the thing worth stating rather
  than discovering on a bill, and the row says so in 78 characters: *"Names the
  transcript file — one extra model call per dictation, in every mode."*

  **It first shipped at 228 and the native host is what caught it.** The
  Verbatim ruling and the fallback were both in the row; jsdom sees a correct
  string and WebKitGTK draws four lines against neighbours that take one, in a
  budget of ≤ 90 characters on one line. Both facts are already recorded — the
  ruling in ADR 0087, the fallback in ADR 0077 — which is where a fact that does
  not fit a row belongs.

**Measured, both ends, in this leg:**

| | `models` | `models#1` |
| --- | --- | --- |
| Before | structural 0 \| style 0 | structural 0 \| style 0 |
| After | **structural 6 \| style 6** | structural 0 \| style 0 |

The six structural differences are the row's own six nodes (`div.job`, its
`div.job-text`, the `b` and `span` inside it, `div.job-ctl`, and the badge). The
six style differences are one height, reported once at each of the six ancestors
it cascades through. **Nothing shifted.** `JobNone` renders `div.job` where
`LaneJobRow` renders `details.job`, so the two occupy separate index spaces in
the diff's sibling numbering and an appended flat row moves no path at all.

## Consequences

- **`port:diff` is 24 of 25 at structural 0 | style 0, with `models` at 6 | 6**
  as the one recorded departure -- the only one on the list, since ADR 0068's
  `profiles` left the gallery with its screen in Leg 8. The 33 differences the
  run still prints are all in the `text` column, the soft category Leg 2a
  recorded as false positives and no leg counts.
- **ADR 0087's eighteen is not withdrawn and not wrong.** It is the correct
  price of the row it measured. It is recorded here as belonging to a shape this
  record rejects, so a later reader comparing the two numbers finds the reason
  rather than a contradiction. This is why a departure gets its own commit and
  its own before-and-after: an estimate carried forward one leg is an estimate of
  something nobody re-checked.
- **The rule the list is read by is now written on the list**: one row per job
  that RUNS a model, not per job that SETS one. Titles is the case that
  separates the two, and it is the case that would otherwise have gone on being
  invisible.
- **`Models.test.tsx` asserts both halves** -- that the row states which model
  runs it, and that it is not a `<details>` and holds no control. The failure
  mode this guards is somebody making it a `LaneJobRow` for consistency with the
  eight rows above it, which would draw a picker for a choice the runtime does
  not read and cost the screen twelve more differences.
- **The §2.5 entry closes.** "AI Models has no row for the title model call" was
  the drawn-design debt ADR 0087 opened, and this is the row.
