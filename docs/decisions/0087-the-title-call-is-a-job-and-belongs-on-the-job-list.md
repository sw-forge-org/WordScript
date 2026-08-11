# 0087: The title call is a job and belongs on the job list

Date: 2026-08-11
Status: Accepted

## Context

ADR 0077 spends a model call on every dictation to name the transcript file, and
named the cost itself:

> **One extra model call per dictation.** [...] It is also the first call the
> product makes that is not about the text the user gets, which is worth stating
> rather than discovering on a bill.

It is stated in that record and on no surface. Every other model the product
runs has a row on AI Models' job list — dictation, meetings, upload, cleanup,
rewrite, translate, prompt enhance, the assistant, the desk's voice. Titles is
the only one that runs a model and has no row.

ADR 0077 left the shape of the answer open:

> A per-job model row for titles belongs on AI Models' job list, which is drawn
> design work rather than a runtime gap, and it can arrive later without
> changing anything here.

**The screen's own argument settles whether it belongs.** AI Models carries a
fourth group for the modes that run no model at all, and its reason is written
into the code: *"why can I not set a model for Verbatim" is answered by seeing
it stated, not by its absence.* Titles is the inverse case — a job that runs a
model the reader cannot see — and the same argument covers it.

**One question was raised and answered by the owner.** The title call reaches
the chat model in every processing mode, Verbatim included, where
`transform.rs` records that *"Verbatim does not reach an LLM at all"*. Asked
whether that is a breach of Verbatim's contract, the owner ruled it is not: the
call is deliberate and mode-independent, naming a document is not rewriting it,
and ADR 0077's fallback already covers the case where no model is configured or
the call fails. **No mode suppresses it**, and that is now written down rather
than implicit.

## Decision

**Titles becomes a row on AI Models' job list, and it is not drawn in this
leg.**

- **It belongs**, by the screen's own rule: one row per job that runs a model,
  plus the group that exists to state the jobs that run none. A cost paid on
  every dictation and named on no surface is the omission ADR 0077 predicted.
- **The row states rather than sets.** ADR 0077 resolves the model through
  `chat_model_for_provider` — the same one Agent, Translate and Prompt Enhance
  use — and adds no setting. A per-job override is a further decision, not a
  precondition for saying what runs.
- **It is not built here, and the reason is measured rather than asserted.** A
  ninth job row was added and `npm run port:diff` run against it: `models` goes
  from **structural 0 | style 0** to **structural 18 | style 6**, because the
  diff walks by path and an inserted element shifts every sibling index after it
  — the same mechanic ADR 0082 recorded when a removed element took `profiles`
  from structural 5 to 14. The row was then reverted and `models` measured back
  at 0 | 0.

  That is a screen departure of the kind ADR 0068 records, on a screen this leg
  was sent nowhere near, and it should arrive in its own commit with its own
  before-and-after numbers rather than as a footnote to a decision about
  `Profiles`. Leg 7 reverted two menu anchors for the same reason.

## Consequences

- **The leg that draws the row inherits a measured cost**, not an estimate: 18
  structural and 6 style differences on `models`, and the expectation for
  `port:diff` drops from 25 of 25 to 24 of 25 with `models` named as the
  departure.
- **Nothing about ADR 0077 changes.** The call, its timing, its fallback and its
  prompt stand, and the owner's ruling makes the mode-independence explicit
  rather than incidental.
- **The Verbatim question is closed rather than open.** It is recorded here so
  that the next reader who notices `title_for` running under Verbatim finds the
  answer instead of filing it again.
- **The row is owed and this record is the receipt.** It is the second entry on
  the §2.5 list that is a drawn-design debt rather than a runtime gap, which is
  the distinction that keeps "not wired" from silently absorbing "not yet
  designed".
