# 0221 — A token budget is what the answer may cost, and the thinking is charged on top of it

Date: 2026-08-18
Status: accepted. Completes
[ADR 0214](0214-a-reasoning-model-is-told-how-much-to-think-and-the-catalogue-is-where-that-is-written.md),
which closed one half of this and left the half that was still failing.
Track: Speech (B24)

## Context

The owner reported on 2026-08-18 that **History still generates no titles**, and
that Written and Heard can be told apart in the segment while Title cannot.

ADR 0214 was given the same report the day before and answered it: Groq retired
`llama-3.3-70b-versatile` on 2026-08-17, every chat model it serves in that
model's place reasons, and a reasoning model with no `reasoning_effort` set
spends its whole completion budget thinking and returns an empty string. That
record added `reasoning_effort` as a catalogue column, defaulted the two
`gpt-oss` rows to `low`, and measured the result.

**It measured the wrong model.** Its own words — *`gpt-oss-20b` with no effort
set spends 46 reasoning tokens against the 48-token title budget* — name the
model the CLEANUP job runs on. The title does not run on the cleanup job. It
rides the assistant's resolution, for the reason
[ADR 0087](0087-the-title-call-is-a-job-and-belongs-on-the-job-list.md)
gives, and the assistant runs `gpt-oss-120b`.

Measured live against `api.groq.com` on 2026-08-18 with this machine's key, the
real prompt and the real budget:

| Model | `reasoning_effort` | `max_tokens` | reasoning | `finish_reason` | content |
| --- | --- | --- | --- | --- | --- |
| `gpt-oss-120b` | *(unset)* | 48 | 46 | `length` | `''` |
| `gpt-oss-120b` | `low` | **48** | **38** | **`length`** | **`'de\n'`** |
| `gpt-oss-120b` | `low` | 512 | 38 | `stop` | `'de\nCode Review Anfrage'` |
| `gpt-oss-20b` | `low` | 48 | 5 | `stop` | `'de\nReview der letzten Commits und Änderungen'` |

`low` took 120b from 46 reasoning tokens to 38, against a budget of 48. That
leaves ten, which is enough for the language line and nothing after it. The
request succeeds, the response is `HTTP 200`, and `parse_naming` reads a
perfectly good language code off a reply whose title was never written.

So the defect did not present as a failure at any layer. The runtime log for the
last dictation before this record reads:

```
Groq correction start model=openai/gpt-oss-120b timeout_ms=5000 retries=0 prompt_chars=1164 max_tokens=48
Groq chat.completions success attempt=1 status=200 elapsed_ms=217
```

and the record it produced carries `"title": null`.

**The second symptom is the same defect seen from the far end.** `titleOf` falls
back to the written text when a record has no title — deliberately, and
[History's own docblock](../../src/screens/History.tsx) says why — so with every
record untitled the Title segment renders exactly what Written does. Nothing is
wrong with the segment.

**Two more callers sit under the same edge**, and neither had been noticed:

- `agent`'s intent classifier asks for `CLASSIFIER_MAX_TOKENS = 10`. On any
  reasoning model it returns nothing at all, the call errors, and the classifier
  falls back to *not the assistant* — so Auto has not routed to the assistant on
  this machine since the retirement. The fallback is safe, which is why it was
  silent.
- `transform`'s correction sizes its budget from the input with a floor of 40,
  so a short dictation's cleanup is under the same edge as the title.

## Decision

**`max_tokens` on the wire caps reasoning and answer together. Every caller in
this product means *how long may the answer be*. The adapter translates between
the two, because the adapter is the layer that knows the wire's reading.**

`completion_budget` in `core::providers::openai_compatible` answers both halves
of one question — the effort to post, and the budget to send with it. Where the
catalogue names an effort, the caller's budget gets `REASONING_HEADROOM_TOKENS`
added to it.

**One constant rather than a second catalogue column.** `reasoning_effort` is a
fact about a model: it is a documented parameter with a fixed set of values, and
a row can state it. What a model then spends thinking varies per prompt, so a
per-row headroom would claim a precision we do not have and would go stale at
every read-date. 256 clears the two measured rows — 38 and 5 — several times
over.

**The headroom costs nothing when it is not used.** A budget is a cap and not a
reservation; the 120b call that now returns at 56 completion tokens is billed
for 56.

**`none` gets no headroom**, and that is not a special case: it is the one value
that switches reasoning off — `qwen3.6-27b`'s row — so there is nothing to leave
room for. **A model the catalogue does not carry keeps the caller's budget
untouched**, because a typed override reaches the wire as written
([ADR 0115](0115-a-model-name-is-a-dated-row-in-one-catalogue-and-neither-runtime-spells-it-alone.md)) and
inflating a budget for a model we cannot say reasons would be the adapter
guessing.

**And a reply that ran out of budget is a failure, not a short answer.**
`finish_reason: length` says the model was still writing, so what arrived is the
beginning of an answer with nothing marking where it stops. `text_from` refuses
it. Delivering it would mean a cleanup cut mid-sentence, a translation missing
its end, or a title truncated to a language code — text that claims to be
finished and is not, which is
[ADR 0067](0067-local-preview-is-treated-as-an-unpublished-provider-everywhere-it-is-offered.md)'s rule applied to a completion.

**Every caller was already built for that refusal and none of them was being
reached.** A correction falls back to the raw text with
`post_correction_failed_fallback`, a translation with `llm_call_failed`, a
classifier to *not the assistant*, a title to the first-words slug — and each of
them says so, in the record or the log. A truncated string arriving as `Ok` is
what let a `status=200` be indistinguishable from a failure for a day.

The start line now states both numbers, so the two readings can never again be
confused in a log: `max_tokens=304 answer_tokens=48 effort=low`.

## Consequences

- The title returns. Verified against the live API at exactly the budget the
  adapter now sends: `max_tokens=304`, `reasoning_effort=low`, 40 reasoning
  tokens, `finish_reason: stop`, `content: 'de\nCode Review der Commits'`.
- Auto's routing to the assistant works again on a reasoning model, and short
  dictations get their cleanup back. Neither was reported; both were found by
  reading the budgets against the measurement.
- **The records already written stay untitled.** A title is made from the text
  at the moment it was delivered and this product does not re-open a record to
  name it; the 124 entries between 2026-08-17 11:45 and this change keep the
  first-words fallback. That is the same disposability ruling the owner has
  given three times, applied to a field rather than to a credential.
- `cargo test` 959 → 962, three cases added: the headroom against the budget the
  title actually sends, `none` and an uncatalogued id keeping their budget, and
  a truncated payload being refused where a finished one is not. The truncation
  case fails against the previous parse, which returned `Ok("de")`.

## What this does not do

**It does not re-measure `low`.** ADR 0214 chose the effort and the argument for
it is unchanged; this record is about the budget the effort is spent against.

**It does not make the headroom configurable.** A number nobody needs an opinion
about is a fixed setting
([ADR 0216](0216-a-setting-nobody-needs-an-opinion-about-is-removed-rather-than-marked-and-that-is-the-limit-of-the-sketch-is-the-deliverable.md)),
and this one is derived from a measurement rather than from a preference.
