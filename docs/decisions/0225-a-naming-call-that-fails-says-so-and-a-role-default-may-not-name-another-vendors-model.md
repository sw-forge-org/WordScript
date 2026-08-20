# 0225 — A naming call that fails says so, and a role default may not name another vendor's model

Date: 2026-08-18
Status: accepted. Completes
[ADR 0221](0221-a-token-budget-is-what-the-answer-may-cost-and-the-thinking-is-charged-on-top-of-it.md)
(the diagnosis it made possible) and
[ADR 0215](0215-the-surface-asks-the-runtimes-own-question-about-a-stored-model-and-a-retirement-is-what-made-the-difference-visible.md)
(the rule, on the field it did not reach).
Track: Speech (B26)

## Context

The owner reported on 2026-08-18 that **title generation still does not work
for History items.** This is the third report of the
same symptom and the first one where the runtime was already correct.

**ADR 0221's fix works, and the log proves it.** Since the reasoning headroom
landed, every naming call on this machine has succeeded — four calls, four
titles, `answer_tokens=48 effort=low max_tokens=304`, and the last three records
in `history.json` are named. What the owner is looking at is the 134 records
written before it, which cannot be named: a title is made at delivery and nothing
re-opens a record. Asked, the owner ruled them out of scope — **they do not
matter, and this is not going to fail over dev legacy** — so no backfill is
built and none is owed.

**What is still wrong is that this call cannot be diagnosed at all.** On the
reporting machine, 2026-08-18 at 01:09, a 1438-character dictation completed with
a cleanup call logged, an insert logged, a session logged, and **nothing between
them**. `create_chat_completion` returned `Err` before the adapter's own start
line — a credential the account did not hold — so the title came back empty and
the product had no way to say why, on any surface, in any file. Reconstructing
that afternoon took a log, a history file and a config read side by side.

*It never fails loudly* (ADR 0077) had been implemented as *it never says
anything*. Those are not the same rule. The reader must not be shown a banner
about a filename; that is why the fallback exists. A diagnosis that has now been
paid for three times is worth one line on a log that already carries a dozen per
dictation.

**And the same read found a second thing, one field over from ADR 0215.** That
record made `named_model` refuse an id the catalogue attributes to another
vendor, because sending it is either a wasted request or a silent substitution —
*the lie is quieter than the failure and therefore worse*. It fixed the job's own
model and left the role default under it untouched. `speech.model` is the
profile-wide answer for every speech job, so a profile whose account moves to a
second vendor goes on sending the first vendor's id.

Measured, not supposed. Five dictations on the machine's OpenAI account:

```
[WordScript] OpenAI substituted a model belonging to another lane
             role=speech requested=whisper-large-v3 owner=groq using=whisper-1
```

`openai::resolve_model` swapped it, logged the swap and answered — and
`history.rs` reads the same function for the record, so all five entries are
stored naming `whisper-large-v3-turbo`. **A record naming a model no request
carried** is ADR 0203's rule broken on the model exactly the way speech track
B18 had just repaired it on the language, one field over, four days later.

## Decision

**`transcript_store::describe` states its outcome on every dictation**, in three
shapes that were one silence:

| | |
| --- | --- |
| `naming skipped reason=no_text\|no_model` | nothing to name, or a job whose vendor resolved to nothing — a configuration state, not a call that went wrong |
| `naming FAILED … kind=… error=…` | the call was made and did not answer, with the account named |
| `naming done title_len=… language=…` | it answered, and `title_len=0` here is ADR 0221's defect shape seen from this end |

The account is in the line because that is the field that has been wrong twice.
**The length and not the title**: a title is a six-word summary of what somebody
dictated, every other line on this log reports a length, an id or a duration and
never the text, and a log is what gets attached to a bug report. The length
separates the three states this line exists to tell apart, which is all it is
for. The language code is a classification rather than content, and the record
already carries it.

**`AppConfig::speech_model` holds the role default to `named_model`'s rule.** An
id the catalogue attributes to another vendor answers `None`, which this function
already documents as *the adapter picks* — and which is precisely what happens.
It is the only answer that does not invent the id the adapter WOULD pick, the
failure class ADR 0203 named. A self-hosted id is in no catalogue by construction
(ADR 0115) and passes untouched; so does an id shipped after this build's
read-date.

## Consequences

- **The request and the record are fixed by one change**, because they read one
  function: the capture stops sending a foreign id and the entry stops naming
  one. A record whose model reads absent means the vendor's own default ran,
  which is true and was previously false.
- **+1 Rust (963)**, proved to fail against the defect first: with the guard
  removed the case reads `Some("whisper-large-v3")` where the account is OpenAI.
- **The log lines carry no test**, and that is deliberate — a case asserting a
  format string pins the wording rather than the fact. What earns a case here is
  the resolution rule, and it has one.
- **No frontend moved.** History already draws a title where a record has one and
  falls back to the written text where it does not, which is ADR 0078's rule and
  is right for the 134.

## Alternatives considered

- **Name the 134 records retroactively**, from a button on History. Ruled out by
  the owner as dev legacy. It would also have to rename each file to keep the
  folder and the list agreeing about what a record is called, which is a
  destructive edit to a directory ADR 0074 says is the reader's.
- **Surface the naming failure to the reader.** A filename is not worth a
  banner, and the fallback is a usable name. The log is the right altitude.
- **Repair the stored `speech.model` on load.** The owner's standing ruling since
  ADR 0112: local configuration is disposable and a rescue path is not worth its
  cost. Refusing to SEND it costs nothing and needs no migration.
