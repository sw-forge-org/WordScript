# 0188: One call names the file and the language, and it stands behind the insert

Date: 2026-08-17
Status: Accepted. Home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)), reaching into the
naming call ADR 0077 built. Extends the language measurement
[ADR 0180](0180-the-lane-that-most-dictations-take-never-names-a-language-so-the-language-is-measured-on-the-text.md)
settled and corrects what
[ADR 0186](0186-a-tile-explains-itself-everywhere-and-only-german-was-a-claim-the-record-never-made.md)
only explained.

## Context

ADR 0180 measures the language of a dictation offline, on the delivered text,
with trigram statistics. It refuses anything under about a sentence, and on this
machine that is 40 runs in 107. ADR 0186 made the surface honest about those
refusals; it did not make them fewer, and the owner asked the obvious next
question: **would a model do better, given that one already runs?**

Three facts decided it.

**A chat call already happens on every dictation.** `transcript_store::title_for`
runs on the main pipeline (`lib.rs`), the preview commit (`sessions.rs`) and the
retry (`history.rs`), on the Assistant job — Claude Sonnet on the Cloud lane, a
local chat model on the Local one. 600 characters in, 32 tokens out, temperature
zero, four-second timeout, one attempt, every failure silent. The marginal cost
of a language on that call is two output tokens.

**The processing call cannot carry it.** The obvious saving — fold the naming
into the transform and make one call instead of two — fails on its own terms:

- **Verbatim makes no transform call at all.** `ProcessingMode::Verbatim` is
  `post_process: false`, so in that mode there is nothing to fold into. The
  naming call is the only one every mode makes.
- **Translate, Draft and Prompt Enhance answer about the wrong text.** Their
  output is in another language, or is a model's prose rather than the reader's
  sentence. A language read off that call describes what came out.
- **And its answer IS the delivered text.** The transform's contract is *reply
  with the text and nothing else* — the strictest one in the product, because
  what it returns goes to the cursor. A model given a second task there writes
  `de` into somebody's email the first time it misplaces a separator. The naming
  call cannot do that: its worst failure is an ugly filename.
- Latency, last but not trivially: the transform is on the critical path this
  product publishes as `Turnaround` (ADR 0181, median 1,210 ms here). The naming
  call is not.

**Except that it is — on every path, and twice on the one this machine uses.**
`transcript_store.rs` states the opposite in a comment: *the file is written
after the text has already reached the cursor, so nothing the user is waiting for
is behind this.* Reading the callers, that was true of the retry and of nothing
else.

- `lib.rs` awaited the call **between the transform and the branch** — so before
  `insert_transcription_from_legacy` on the direct path, and before the preview
  was staged on the parked one. Up to four seconds of filename in front of the
  overlay a reader is waiting for.
- **And on the parked path the answer was then thrown away.** That branch stages
  the preview and returns; the record is written later by
  `commit_pending_transcription_preview`, which names the committed text again.
  One wasted chat call per parked dictation — about fifty a day here.
- `commit_pending_transcription_preview` then awaited its own call **before**
  `insert_transcription_from_legacy`, so pressing commit bought another four
  seconds before anything moved.

That path is how a clipboard-only profile delivers, and 49 of this machine's last
50 dictations were clipboard deliveries. The question that started this was
whether the product could get away with fewer calls; the honest answer is that it
was already making one more than it needed, in the worst possible place.

**And the measurement reads the wrong text in three modes.** ADR 0180 measures
the DELIVERED text, which is right for a file and wrong for the counter: in
Translate the tile has been counting the language somebody translated INTO, and
in Draft and Prompt Enhance the language a model chose to write in. The question
the tile asks is *which languages do you dictate in*.

## Decision

**The naming call answers two lines: the title, then the language.** One request,
one round trip, `max_tokens` from 32 to 48. `title_for` becomes `describe` and
returns `TranscriptNaming { title, language }`, which travels as one parameter
the way `CaptureFacts` does — the alternative was a tenth positional argument on
`history_entry_from_insert_result`.

**The model is given a way to refuse.** The code line is two lowercase letters,
or `??` when it cannot tell. A model with no refusal available invents one, and
this product would rather have a gap than a confident wrong answer — the same
principle as whatlang's reliability gate, asked of a different instrument.

**The language is asked FIRST and the title second, and that order was paid
for.** The first draft asked for the title on line 1 and the code on line 2, and
the very next German dictation came back titled `Language Comparison
Discussion` — where every title before it had been German. A closing block
reading `de for German, en for English` is a closing block of English, and the
title is written under it. Asking for the code first fixes it twice: the last
instruction the model reads is the title rule, and it has already committed to
the language that rule now points at. The parse does not depend on the order —
the code is whichever line is two lowercase letters — but the model's output
does.

**The offline detector stays, as the fallback and not as a legacy.** `describe`
answers `None` on a timeout, a missing key, an unconfigured or undownloaded chat
model, and every offline run. Without the fallback the tile would go dark exactly
on the lane ADR 0180 exists to serve. Order: the model where it answered, the
trigrams where it did not, nothing where neither could.

**The language is measured on what was SPOKEN, not on what was delivered.** The
raw transcript where the record has one, the delivered text where it does not —
the same correction ADR 0177 made to the speaking rate, for the same reason. And
in the three modes where the two texts are not the same language by construction
— Translate, Draft, Prompt Enhance — **the model's answer is discarded**, because
that answer describes the file it just named. Those modes fall to the trigrams on
the spoken text. `mode_keeps_the_spoken_language` states the rule beside
`mode_credits_typing`, where the other mode-shaped exception already lives.

**A language needs three words.** Below that neither instrument is asked: the
model would name one for `Removing` and for `Ja`, and a counter that tallies
interjections drifts toward whatever short exclamations look like. Three rather
than the trigram detector's eight, because that is where a model stops guessing
and starts reading — `Whats up my fellow American` is five words, is English, and
is exactly the run that started this.

**Every caller names after it has delivered.** Order becomes deliver → name →
record, on the pipeline and on the commit alike: the record needs the answer, the
reader does not. The pipeline's call moves inside its insert branch, which also
removes it from the parked path entirely — that branch never used the answer, and
the commit path asks for it again on the text that is actually being committed.

**So a parked dictation makes one naming call instead of two**, and neither of
them stands in front of anything.

## Consequences

- Nothing was merged into the transform, and a parked dictation now makes ONE
  naming call where it made two. In Cleanup that is two chat calls per dictation
  rather than three; in Verbatim it is one rather than two.
- No delivery waits on a filename any more. Worst case improves by up to the
  four-second timeout in front of the preview, and again by up to four in front
  of the commit's insert — on a parked dictation, both.
- The tile's coverage goes from what trigram statistics can carry — 63 % of this
  machine's record — to what a model can, on every lane that has one configured.
- **The figure stops being deterministic.** Two identical dictations may be
  tallied differently, and no arithmetic explains it. That is acceptable for a
  counter on Home and would not be for anything the runtime decides on.
- A ledger rebuilt from history after a reset re-measures with the trigrams
  alone, because the model's answer is not stored on the record. It is already
  true that a rebuild sees only the last fifty records; this adds no new class of
  divergence, and storing the answer is the change to make if it ever matters.
- Translate runs now report the language you spoke rather than the one you asked
  for. Nothing migrates: the tallies already on disk keep whatever they were
  written from, and the next dictation is measured the new way.
