# 0070: History switches which of a record's two texts its rows carry

Date: 2026-08-10
Status: Accepted

## Context

Every history record holds two texts. `raw_transcript` is the recogniser's own
words, captured in `stage_pending_transcription_preview` before any transform;
`transformed_transcript` is what the AI made of them and what was delivered. On
the owner's machine 92 of 174 records differ between the two, so the pair is
carrying real signal rather than duplication.

**The prototype titles each row with the written text**, and for the screen it
drew that is right: History is a record of *what you got*, and what you got is
what was delivered. The recogniser's version is one fold deep behind *View raw*,
per record, where `RawPanel` shows the two side by side.

Leg 4c raised the problem and did not take the decision, because the title is
drawn and the gallery is the source (ADR 0057): **the surface a person goes to
in order to judge transcription accuracy shows the AI's version of every row
first.** Transcription accuracy is an open defect — `docs/known-issues/
transcription-accuracy.md`, and the STT prompt leaking into transcripts
(`stt-prompt-leaks-into-the-transcript.md`) is a defect that appears in
`raw_transcript` and is *cleaned away* by the transform, so the record of what
you got hides the recogniser fault completely.

Judging accuracy means SCANNING. Opening 174 folds is not scanning.

Put to the owner on 2026-08-10 with three options — a segment over the list, a
"changed only" filter, or leaving it and documenting it. He declined to pick and
asked for whichever makes the most semantic sense, noting that the current
behaviour also makes sense.

## Decision

**A `Written` / `Heard` segment in History's toolbar, switching which of the two
texts every row title carries. `Written` is the default.**

- **The default is the drawing.** At rest the screen is exactly what the
  prototype draws, so the second reading is opt-in and the first is not
  demoted. This is what makes the addition a growth rather than a re-titling —
  Leg 4c was right to refuse the re-title.
- **A segment, not a select.** The status control beside it is a filter: it
  narrows the list and moves the count. This narrows nothing. A second select
  would look like a second filter and behave like neither; a segment shows both
  readings and the current one at once, which a reader scanning rows for
  recogniser errors needs to see without opening a control to find out.
- **Not the "changed only" filter.** It answers a different question. Narrowing
  to the 92 records the AI changed still shows the AI's text in all 92 titles.
- **No fallback under `Heard`.** If `raw_transcript` is empty the row says
  *"Nothing was heard in this capture."* Borrowing the transformed text would
  put the AI's sentence behind a label promising the opposite, which is the
  fake-readiness rule applied to a word instead of to a state.
- **`View raw` is untouched.** The segment is for scanning a list; the fold is
  for comparing one record's two texts side by side. They answer different
  questions and neither replaces the other.

## Consequences

- **`npm run port:diff -- history` stops measuring 1:1** from this commit,
  because the toolbar gains an element the prototype does not draw. That is the
  second of the 28 measurements to move in Leg 4d — ADR 0068 moved `profiles` —
  and both are recorded departures rather than drift. The other 26 are
  unaffected.
- **It is a view state and is not persisted.** Nothing in `AppConfig` carries
  it and nothing should: it is which way you are reading the list right now,
  the same kind of state as the search box beside it, which also saves nothing.
- **`docs/known-issues/transcription-accuracy.md` keeps its record.** The screen
  can now be used to judge the defect; the defect is not fixed by being
  visible, and the entry stays open until the recogniser's own accuracy is.
