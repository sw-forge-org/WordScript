# 0205: A retry names the recogniser that produced its text, and only the retry that listened again names this machine's

Date: 2026-08-17
Status: Accepted. Follows
[ADR 0203](0203-the-model-a-record-names-is-the-one-the-profile-sent-and-a-lane-that-sent-none-names-none.md),
which fixed the same question one path earlier.

## Context

ADR 0203 made `provider` and `model` name the recogniser a record's
`raw_transcript` actually came out of. It left one path stating the question
rather than answering it, in a comment in `history.rs`: a retry re-runs the
transform over a transcript that already exists, **nothing listens**, and the
record it writes named this machine's *current* recogniser anyway.

Reading the path closely turned that into a sharper problem and a sharper
answer, because **there are two kinds of retry** and they are not the same fact:

```rust
let raw_transcript = match existing.raw_transcript.clone().filter(…) {
    Some(transcript) => transcript,                        // only the transform re-runs
    None => transcribe_retained_capture(&existing).await?, // the kept audio is sent again
};
```

The second one **does** listen, and deliberately through the current config —
`transcribe_retained_capture`'s own doc says why: *"the retry happens because
something was wrong, and the fix is often a setting the user changed in
between."* So naming the current profile is right there and wrong one branch up.

A third disagreement was underneath both. The retry's two record-writing
branches did not even agree with each other: the empty-text branch wrote
`provider: retry_job.provider` — the **transform** job's vendor — while the
successful branch went through `history_entry_from_insert_result` and wrote the
**recogniser's**. One retry, two answers to one field, decided by whether it
produced text. The comment above the empty branch had asked for the opposite:
*"resolved once so the log line, the empty-text record and the successful record
all name the same vendor."*

And the same wrong attribution reached four more fields. `provider_profile`,
`local_prompt_strength`, `local_beam_size` and `local_best_of` describe the
decode settings of a request; on a transform-only retry they were re-read from
the current config, so a record could carry beam settings from a lane that never
saw its audio.

## Decision

**The four recogniser fields are one answer, and which record it comes from is
decided by which retry ran.**

```rust
pub enum RetryOrigin<'a> {
    Transformed(&'a TranscriptionHistoryEntry),    // nothing listened
    Retranscribed(&'a TranscriptionHistoryEntry),  // the audio went out again
}

struct SpeechAttribution { provider, model, local }
```

`SpeechAttribution::for_retry` maps `Transformed` to the retried record's values
— copied whole, including a `None` model, because a record that names no
recogniser cannot lend one — and `Retranscribed` and the live paths to this
machine's active profile.

**The kind travels instead of the id.** `history_entry_from_insert_result` took
`retry_of: Option<&str>`; it takes `Option<RetryOrigin<'_>>` now and derives both
the id and the attribution from it. The live call sites pass `None` and did not
change, which is the point of putting the fork in the type: a caller cannot
supply a retry id without saying which kind of retry it was.

## Consequences

**Both retry branches name the same vendor**, which is what the resolution they
were built on asked for and did not get.

**A per-model or per-lane count may now include retries** without mixing in a
recogniser that did not run. Before this, a machine that changed profiles
between a dictation and its retry produced two records disagreeing about where
one transcript came from.

**Four cases hold it** in `history.rs`: a transform-only retry inherits provider,
model and the whole decode block; a re-transcribing retry takes the current
profile's and none of the retried record's; a retried record with no model lends
none; and a session with no origin is unchanged.

**The retry's own vendor is still recorded, in the runtime log line that already
carried it** (`History retry start … job= provider= overridden=`). It is not on
the record, and that is deliberate: the record's `provider`/`model` pair answers
one question — what listened — and a field that answers two questions depending
on the row is the defect this ADR and ADR 0203 both exist against.
