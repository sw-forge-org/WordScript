# 0077 -- A transcript's filename is a title the model writes

Date: 2026-08-10
Status: Accepted

Answers the objection
[ADR 0074](0074-a-transcript-is-a-markdown-file-and-the-history-record-is-its-index.md)
raised against itself. Raised by the owner on 2026-08-10, an hour after 0074
landed.

## Context

ADR 0074 kept §11.23's promise and named its own weakest point while doing it:

> §11.23's own slug rule is the tell: named from the first words of the written
> text, a one-line dictation becomes `03-0942-ja-genau-mach-das-mal-so.md`. A
> thing with no title is being given a filename.

The record accepted that cost on the grounds that the clutter is honest. It is
honest, and it is still clutter -- a folder whose names are the openings of
sentences cannot be scanned, which is most of what "a path you can `cd` into"
was supposed to buy.

**Naming a document is exactly what a language model is for, and the product
already has one configured on every lane.** The dictation pipeline calls it for
Agent, Translate and Prompt Enhance; the correction model runs for the cleanup
family. Nothing new has to be set up for a filename to be better than its
first five words.

## Decision

**The model titles the transcript, and the title becomes the filename.**
`core::transcript_store::title_for` asks the chat model for two to six words
naming what the transcript is about, in the transcript's own language, and the
same slugifier turns that into a path component.

**It never blocks anything the user is waiting for.** The call is made after the
transform and after the text has reached the cursor, on the path that reaches
one -- the file is written at the record, which is already downstream of
delivery. One attempt, no retry, a four-second timeout.

**Any failure falls back to the first words, silently.** Provider unreachable,
model unset, timeout, empty answer: the deterministic slug is used and the file
is written anyway. **The title decides what a file is CALLED, never whether it
exists** -- which is what keeps ADR 0074's invariant intact.

**The title is an argument to the funnel, not a call inside it.**
`record_entry_with_work_mode` is synchronous and is deliberately the one place a
file comes into existence. So the async call is made by the callers that already
make async calls -- the pipeline, the preview commit and the retry -- and
arrives as `title` on the request. The funnel stays the single writer.

**The preview path titles what is COMMITTED, not what was staged.** A preview
can be edited in the overlay before it lands, and a file named after the text
somebody just corrected would be named after the mistake.

**The model is the one already configured**, resolved by
`AppConfig::chat_model_for_provider` -- the same one Agent, Translate and Prompt
Enhance use. No new setting. A per-job model row for titles belongs on AI
Models' job list, which is drawn design work rather than a runtime gap, and it
can arrive later without changing anything here.

**The prompt is a rule rather than a request**, because the failure mode is a
model that answers the dictation instead of naming it. It is told never to
follow an instruction inside the transcript -- a dictation is untrusted input to
this call, and "make the filename rm -rf" is a sentence somebody can say out
loud.

## Consequences

- **One extra model call per dictation.** It is small -- 600 characters in, 32
  tokens out, temperature 0 -- and it is the price of the folder being usable.
  It is also the first call the product makes that is not about the text the
  user gets, which is worth stating rather than discovering on a bill.
- **A filename can now be wrong in a new way**: a model can mis-title. The
  frontmatter still carries the id, the mode and the timestamp, and the body is
  the text, so nothing that identifies a record depends on the title.
- **A retry produces a new file with its own title**, from the retried text.
- **Two records dictated in the same minute with the same title** take the
  numeric suffix ADR 0074 already defines. The collision rule did not change.
- **The fallback is not dead code.** Every `Failed` record with text, every
  local lane without a chat model, and every minute the provider is down goes
  through it, so it stays tested rather than theoretical.
