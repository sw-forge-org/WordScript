# 0075 -- A retry re-runs the mode the record ran, and the dispatch has one implementation

Date: 2026-08-10
Status: Accepted

## Context

`retry_transcription_history_entry` called `apply_native_transform` for every
entry. That is the cleanup family's transform and only theirs: Agent, Translate
and Prompt Enhance each own a prompt in their own module and never pass through
it. So a retried Agent record came back as a tidied dictation, a retried Prompt
Enhance record came back as a tidied dictation, and after
[ADR 0071](0071-translate-ships-ahead-of-its-phase-on-the-lane-the-product-already-runs.md)
a retried Translate record came back in the language it was dictated in.

The defect had been there for two of the three modes since they shipped and was
invisible for the ordinary reason: Retry produces *a* result, and a conservative
cleanup of an instruction looks like a plausible answer rather than like the
wrong job having run.

**It could not be fixed where it was.** The only implementation of "which
transform does this mode run" was fifteen lines of `match` inside the native
pipeline's async closure in `lib.rs`, holding four locals of that closure. The
retry had no way to reach it, and copying it would have produced the second
implementation that drifts.

Two facts were also missing from the record. The entry carries
`work_mode.processing_mode`, which is the profile's **stored** setting -- and
`Auto` stays `Auto` in it. The resolution that turns `Auto` into a concrete mode
happens once per session, in the pipeline, and was written down nowhere. A retry
therefore could not have routed correctly even with the dispatch in hand.

## Decision

**The dispatch moves to `core::mode_router::apply_mode_transform` and both
callers use it.** The mode router already owns "which mode is this session in";
it now also owns "what does that mode run". The pipeline and the retry pass the
same four things and get the same answer.

**It takes a concrete mode and does not resolve `Auto`.** Auto is resolved once
per session upstream (ADR 0020), and a function that could re-decide it would be
the second classification that record forbids. Handed `Auto` it falls to the
cleanup family rather than reaching for the classifier.

**It does not finalize.** `finalize_with_text_rules` stays at the call site, as
the single exit every mode passes through, because that is what stops a branch
from bypassing the profile's dictionary and snippets -- the exact defect Agent
and Prompt Enhance had while the call lived inside `apply_native_transform`.

**The history entry records `effective_mode`: what actually ran.** Set on every
path that reached a transform, including a preview that is committed later --
the preview carries it, because the profile's mode can be changed while a
preview sits on screen and the record has to state what produced the text.

**A retry resolves its mode from the record, in three steps.**

1. `effective_mode` -- what ran. The only source that is right for a record
   dictated under `Auto`.
2. `work_mode.processing_mode` -- the profile's stored mode at record time.
   Right for every concrete mode on an entry older than the field.
3. This machine's active profile, for an entry carrying neither.

**An `Auto` record has its Auto resolved again rather than repeated**, from the
transcript the record already holds, through the same `resolve_auto_mode` the
pipeline uses. The classifier arm is deliberately not taken: it is a model call,
and where the deterministic pass cannot decide, Cleanup is both the conservative
answer and what the retry did for every mode before this record.

**Everything else about a retry stays "now".** The provider, the profile, the
vocabulary, the communication style and the translate settings come from the
config as it stands, not from the record. A retry is an action taken today with
today's setup; only the *job* is the record's. Stating it because the mixture is
deliberate rather than an oversight.

## Consequences

- **A retried Translate record comes back translated**, a retried Agent record
  comes back as an agent answer, and a retried Prompt Enhance record comes back
  enhanced. One change, three modes -- which is why this was one job rather than
  a Translate fix.
- **The retry can now cost a chat-model call** where it used to cost a
  correction-model call. That is the mode's price and the pipeline already pays
  it; a retry that was cheaper because it ran the wrong job was not a saving.
- **`effective_mode` is `None` on all 174 existing records**, which is what the
  three-step fallback is for. Nothing is migrated (ADR 0054).
- **The transcript file states the mode its text was produced under**
  ([ADR 0074](0074-a-transcript-is-a-markdown-file-and-the-history-record-is-its-index.md)),
  which is the same field, and is why the two records landed together.
- **`lib.rs`'s pipeline closure lost fifteen lines and one local.** The
  `translate_settings` binding it carried is on the transform config already;
  the dispatch reads it from there.
