# 0249 - Heard is the recogniser's own output, so the boundary moves above the confidence gate and the gate records what it removed

Date: 2026-08-23
Status: **Accepted.** Settles the decision
[`known-issues/heard-names-two-different-boundaries-and-the-text-one-is-later.md`](../known-issues/heard-names-two-different-boundaries-and-the-text-one-is-later.md)
opened and left open, and closes it.

Corrects the reading of [ADR 0016](0016-a-speech-gate-and-confidence-gate-sit-before-ai-cleanup.md),
whose gate this moves out of the record's way; extends
[ADR 0070](0070-history-switches-which-of-a-records-two-texts-its-rows-carry.md)
and [ADR 0204](0204-the-raw-panels-foot-names-the-rule-that-changed-the-text-and-claims-only-what-the-diff-proves.md),
whose panel and foot sentence this gives a fourth stage to name; and pairs with
[ADR 0247](0247-a-wait-is-two-stages-so-the-runtime-measures-both-and-the-metric-detail-states-its-reading-before-it-draws-the-evidence.md),
whose `heard in` column was the honest half of the two meanings this record
found.

## Context

### One word marked two instants one stage apart

ADR 0247 put the word `heard` on the Home turnaround detail, where `heard_ms` is
stamped the moment the provider answers. The History panel had carried the same
word since ADR 0070, over a text. Verifying ADR 0247 against the real store
showed the two were not the same boundary:

```text
let heard_ms = export_ms + pipeline_started_at.elapsed()…   // the provider answered
match transcription { Ok(response) => {
    …staleness check…
    let (mut response, low_confidence_segments)
        = apply_confidence_gate(response);                   // <-- edits response.text
    …
    let heard_text = response.text.clone();                  // nine lines later
```

`apply_confidence_gate` is not a reading. Where `evaluate_segments` rejects a
segment, the function overwrites `response.text` with the surviving segments
rejoined — so whole segments left the text before `heard_text` was taken from
it. The clock was honest and the text was not: the column labelled **Heard** was
the recogniser's output minus whatever WordScript's own filter had removed.

### Nothing on any record said the filter had fired

`apply_confidence_gate` answered a `bool`. It reached `mode_transform_config`,
where it corroborates a language-drift strip, and it reached no record. The
rejected segments — each with a reason, a start and an end — went to the runtime
log, which rotates at 4 MB and is not part of a record.

Measured on the reporting machine on 2026-08-23: the 157 records
`history.jsonl` currently holds contain the string `low_confidence` nowhere, and
4.4 MB of runtime log across two files contains no `Confidence gate rejected
segment` line at all — while the coverage instrument on those same runs reports
verdicts that require segments. So the gate is live on every Groq dictation
here, evaluates real segment metrics, and has never rejected one. That store is
not a representative sample of anything: it has been wiped by refactors more
than once and every record in it is from one profile. It is enough to answer the
one question that mattered before moving the boundary — is there a population of
records whose meaning this changes — and the answer on this machine is no.

### What it cost

The raw panel exists so a reader can tell what changed the text, and ADR 0204
was written because a defect was once attributed to the wrong stage from it. Its
claim — every word of **Written** appears in **Heard**, therefore nothing was
reworded — is a claim about the interval between two stored texts. Any word the
gate dropped fell outside that interval. A gate rejection and a clean
recognition were indistinguishable on every surface, because a removed segment
looks exactly like a segment the recogniser never returned.

### The same word meant a third thing on the retry path

Found in the sweep this decision required. `transcribe_retained_capture`, the
retry for a record that never produced a transcript, ran the recogniser repair
and returned its **output** as the new record's `raw_transcript` — and never ran
the confidence gate at all. So on that path **Heard** named a boundary one stage
*later* than the live path's, with the gate missing entirely, and a retry could
deliver the hallucination the original run's gate had removed.

### And the parked path taught vocabulary from the wrong text

Also found in the sweep. The insert path passes the **repaired** text into
`vocabulary_learning`, deliberately and with the reason stated in the code:
learning reads the raw/final pair as evidence that a correction repaired a term,
and given the unrepaired text it would see WordScript's own stripped prompt as
something the correction removed — and could then propose that prompt as profile
vocabulary. `commit_pending_preview` passed the unrepaired text. That is the
branch **every** dictation on a profile that does not auto-paste takes — the
whole traffic of this machine when ADR 0182 and ADR 0188 were written, and none
of it today: all 157 records in the current store are `direct_paste` on one
profile. The defect is latent here and was not always, and it becomes worse
under this decision rather than better, because the text that branch passed
moves one stage further from the one learning needs.

## Decision

**`Heard` is the recogniser's own output, and nothing of WordScript's stands
above that boundary.** `heard_text` is taken before the confidence gate, before
the recogniser repair and before any mode. `Written` is the delivery, byte for
byte. Everything between the two is a stage, and a stage that changes the text
says so on the record.

Five parts:

1. **The boundary moves above the gate.** The heard text is the provider's
   `response.text` as it arrived. The gate no longer subtracts from the text the
   record keeps.

2. **The gate records what it removed.** `apply_confidence_gate` returns a
   `ConfidenceGateRecord` — the kept text and every dropped segment with its
   reason, start and end — instead of a `bool`. The record stores it in
   `confidence_gate`, `None` wherever the gate changed nothing. The `bool` the
   drift corroboration needs is derived from its presence.

3. **The stage is named where the other two repairs are named.** A run whose
   gate fired carries `low_confidence_dropped` in `applied_rules`, first in the
   list, because the gate runs first. The panel's foot names it, so the gate's
   removal can no longer be read as the AI stage's.

4. **A retry runs on the text the gate left, not on the text that was heard.**
   `HeardFacts::transform_input` answers `kept_text` where the gate fired and the
   heard text otherwise. Without this, moving the boundary would have made every
   retry re-admit exactly the segments the live run threw out.

5. **The heard text and the gate's verdict travel as one value.** `HeardFacts`
   replaces the loose `raw_transcript` argument on every path that writes a
   record. A caller that states a heard text now states what the gate did to it,
   structurally rather than by convention — the two drifting apart is what this
   defect was.

Consequently: `transcribe_retained_capture` runs the same two stages the live
pipeline runs, in the same order, and returns the pre-gate text as the record's
heard text; and the parked commit carries the repaired text separately so
vocabulary learning gets what the insert path has always given it.

### What is not decided here

**No third column.** The panel plane is the narrowest text column on the surface
and three texts where there are two is a layout decision this does not make. The
dropped segments reach the reader in two places instead: the panel's foot names
the stage and the count, and the record's own Markdown file carries the whole
account under `## Dropped` — one line per segment with its place in the audio
and the metric that rejected it. The file is a text file with room for it.

**The repair still does not touch the heard text.** ADR 0080 and ADR 0081 put
the recogniser repair into `response.text` and left `heard_text` alone on
purpose, so the record keeps the evidence of what leaked. That is unchanged, and
it is why `HeardFacts` carries the gate and not the repair: the gate's removal
is stored because it is otherwise unrecoverable, and the repair's output is not
stored because the unrepaired text is the measurement.

**A transform-only retry still does not re-apply the repair.** It did not
before, and this decision does not change it. The behaviour is preserved exactly:
the text such a retry transforms is the same string it transformed before —
post-gate, pre-repair.

## Consequences

**Every stored record's meaning changes, and there is no backfill.** A record
written before today keeps the POST-gate text under `raw_transcript` and carries
no `confidence_gate` field, and nothing on it says which of the two it is. The
removal was never stored, so it cannot be reconstructed. `None` is the honest
answer for those records and the store reads them without the field.

This is smaller than it sounds on this machine and the measurement above is why:
the gate has never fired here, so every existing record's `raw_transcript` is
already the pre-gate text — it just could not be proven from the record. That is
a fact about this store and not about the product. On a machine where the gate
did fire, the affected records silently carry the old meaning and nothing
distinguishes them.

**A record can now be asked whether its Heard was edited.** It could not before,
on any machine, in any record ever written.

**`spoken_words` in the activity ledger counts the pre-gate text** from today.
Records from before count the post-gate one. The difference is the words the
gate dropped, and no record from before says how many.

**Verbatim's row on Models stops claiming more than it does.** It said *what the
recognizer heard, with nothing after it*, and the gate, the repair and the
profile's text rules all run on it. It now says which of those still apply.
