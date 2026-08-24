# `Heard` names one boundary in time and a later one in text, and only the time one is the hearing

Status: **Fixed 2026-08-23 by
[ADR 0249](../decisions/0249-heard-is-the-recognisers-own-output-so-the-boundary-moves-above-the-gate-and-the-gate-records-what-it-removed.md).**
Found the same day. The boundary moved above the gate: `heard_text` is now the
recogniser's own output, the gate records what it removed instead of subtracting
it, and the panel's foot names that stage. The report below is kept as written
and three of its statements no longer hold — the recogniser's own output IS now
stored, the gate's rejections ARE on the record, and the funnel's first cut is
no longer the one after the gate. Two things it says are still true and are the
reason the fix is shaped as it is: there is no backfill, and the panel does not
get a third column.

Three things the sweep this fix required found, which this record did not know
about and which ADR 0249 also settles:

- `transcribe_retained_capture` named a THIRD boundary — it ran the repair, did
  not run the gate at all, and stored the repaired text as the record's heard
  text.
- `Written` is the delivery byte for byte on every path that delivers: the
  runtime stores `insert_result.text`, the string the clipboard or the keystroke
  driver was handed. The open question at the foot of this record is answered
  and the answer is that nothing was wrong there.
- The parked commit taught vocabulary from the unrepaired text while the insert
  path deliberately uses the repaired one.

Found while verifying [ADR 0247](../decisions/0247-a-wait-is-two-stages-so-the-runtime-measures-both-and-the-metric-detail-states-its-reading-before-it-draws-the-evidence.md)
on the real store. The turnaround detail had just been split into `heard in` and
`rewrote in`; the question that opened this record was why two of the mode rows
could not be measured, and it led one screen over.

## The two boundaries

The word `heard` is now on two surfaces, and it marks a different instant on
each.

| Surface | What `heard` means | Where it is taken |
| --- | --- | --- |
| Home → turnaround detail, `heard in` | elapsed time up to the provider's answer | `lib.rs`, `heard_ms`, **before** `apply_confidence_gate` |
| History → raw panel, **Heard** | the transcript text | `lib.rs`, `heard_text`, **after** `apply_confidence_gate` |

In the pipeline the two sit nine lines apart with the gate between them:

```text
let heard_ms = export_ms + pipeline_started_at.elapsed()…   // the time boundary
match transcription { Ok(response) => {
    …staleness check…
    let (mut response, low_confidence_segments)
        = apply_confidence_gate(response);                   // <-- edits response.text
    …
    let heard_text = response.text.clone();                  // the text boundary
```

`apply_confidence_gate` is not a passive reading. When
`evaluate_segments` rejects any segment it overwrites `response.text` with the
kept segments joined back together. Whole segments therefore leave the text
before `heard_text` is taken from it.

The clock is honest: `heard_ms` is the interval up to the provider's answer, and
ADR 0247's column measures what its header claims. The text is not: the column
labelled **Heard** is the recogniser's output minus whatever the gate removed.

## The funnel has four text stages and the record keeps two

```text
recogniser output → confidence gate → recogniser repair → mode transform → delivery
                    ^^^^^^^^^^^^^^^                       ^^^^^^^^^^^^^^
                    edits the text                        the only cut the
                    that becomes "Heard"                  panel calls a stage
```

The record keeps the first cut *after* the gate (`raw_transcript`, drawn as
**Heard**) and the last (`transformed_transcript`, drawn as **Written**). The
recogniser's own output — the text before any WordScript stage — is kept
nowhere and is not recoverable from any record on disk.

The repair stage is correct here and is worth naming so a fix does not
"correct" it: it writes into `response.text` and deliberately leaves
`heard_text` alone, precisely so the record keeps the evidence of what leaked.
Only the gate crosses the boundary, and it crosses it before the boundary is
taken.

## Nothing on the record says the gate fired

`apply_confidence_gate` returns a `low_confidence_segments` flag. It is passed
into `mode_transform_config` and **never written into the history record**. The
rejected segments are written to the runtime log and nowhere else.

Measured on the reporting machine's own store: `history.jsonl` holds 148
records and the string `low_confidence` appears in none of them. That is not
evidence the gate never fired — it is the defect. **No record on disk can be
asked whether its Heard column was edited before it was stored**, and the
runtime log is rotated and is not part of a record.

This is the same shape as the defect ADR 0247 corrected one screen over: a
figure that was correct sitting under a heading that promised a different stage.
Here the text is correct for what it is, and what it is has no name on the
screen.

## Why it costs something

The raw panel exists so a reader can tell what changed the text, and
[the record next to this one](heard-and-written-do-not-say-which-stage-changed-what.md)
was opened because a defect was attributed to the wrong stage from that panel.
The claim the panel is built to support — every word of **Written** appears in
**Heard**, therefore nothing was reworded — is a claim about the interval
between two stored texts. Any word the gate dropped is outside that interval and
is invisible to the check.

Concretely, a gate rejection and a clean recognition are indistinguishable on
the surface: both produce a **Heard** column with no sign of a missing segment,
because a removed segment looks exactly like a segment the recogniser never
returned. The one case that most needs to be visible — audio that was captured,
transcribed, and then dropped by WordScript's own filter — is the one case that
leaves no mark.

## What a fix has to answer

- **Which text is the record's `Heard`.** Moving the boundary above the gate
  makes the panel honest and makes every stored record's meaning change; keeping
  it and naming the gate on the surface does not. These are different products,
  not different implementations, and it is a decision rather than a repair.
- **Whether the gate's own removal is evidence worth storing.** The rejected
  segments carry a reason, a start and an end. Storing them is what would make
  `prompt_echo_stripped`-style attribution possible for the gate too. Storing
  the flag alone answers *whether*, not *what*.
- **What `Written` is.** This record verifies the top of the funnel only. The
  bottom — whether `transformed_transcript` is the delivered text or a cut taken
  before the last stage — is not checked here and must not be assumed from it.
- **It must not add a column.** The panel plane is the narrowest text column on
  the surface. Three texts where there are two today is a layout decision this
  record does not make.

## Related

- [heard-and-written-do-not-say-which-stage-changed-what.md](heard-and-written-do-not-say-which-stage-changed-what.md)
  — the same panel, the sentence under it, and the misattribution that opened
  that record. That one is about attributing a diff; this one is about the diff
  having the wrong left-hand side.
- [stt-prompt-leaks-into-the-transcript.md](stt-prompt-leaks-into-the-transcript.md)
  — why the repair deliberately does not touch `heard_text`.
- ADR 0247, ADR 0248 — the time split, whose `heard in` column is the honest
  half of the pair of meanings above.
- ADR 0080, ADR 0081 — the repair stage and where it runs.
