# 0214: A reasoning model is told how much to think, and the catalogue is where that is written

Date: 2026-08-17
Status: Accepted. Speech track
([`../tracks/speech-track-plan.md`](../tracks/speech-track-plan.md)). Applies
[ADR 0115](0115-a-model-id-belongs-in-one-catalogue-and-nowhere-else.md)'s rule
to a fact nobody had needed before, and is the first entry written because a
vendor removed something rather than because this repo decided something.

## Context

**Groq retired its entire Llama chat line, and the product went quiet rather
than loud.** Read against the live `api.groq.com/openai/v1/models` on
2026-08-17 with this machine's key, three catalogued ids were gone:
`llama-3.3-70b-versatile`, `llama-3.1-8b-instant` and
`distil-whisper-large-v3-en`. The two speech rows this build defaults to —
`whisper-large-v3-turbo` and `whisper-large-v3` — were still there.

That split is why nobody noticed for seven hours. Transcription kept working, so
dictation looked healthy; every text stage answered HTTP 404
`model_not_found`, and the runtime's own fallbacks absorbed it —
`post_correction_failed_fallback` returned the raw text, and
`transcript_store::describe` returned `TranscriptNaming::default()`. The owner
reported it as *History stopped generating titles and the Title/Written/Heard
control stopped working*, which is the same defect seen from the far end: with
no title, `titleOf` falls back to the written text, so two of the three segment
positions render identically.

**Every replacement Groq serves is a reasoning model, and that is not a
substitution a catalogue row can absorb on its own.** Measured against the real
prompts and the real budgets this build sends:

| model | title call, `max_tokens: 48` | median |
| --- | --- | --- |
| `openai/gpt-oss-20b`, no effort set | 46 reasoning tokens, `finish: length`, **empty content** | — |
| `openai/gpt-oss-20b`, `reasoning_effort: low` | 10 reasoning tokens, correct two-line answer | ~180 ms |
| `openai/gpt-oss-120b`, `reasoning_effort: low` | correct | ~320 ms |
| `qwen/qwen3.6-27b`, no effort set | writes its whole `<think>` block into `content` | — |
| `qwen/qwen3.6-27b`, `reasoning_effort: none` | correct | ~215 ms |

An unconstrained reasoning model spends the completion budget thinking and
returns an empty string. On this product that is a dictation whose cleanup
silently did nothing — the failure mode is not an error, it is a no-op that
looks like a pass.

## Decision

**1. `reasoning_effort` is a catalogue column.** It is a fact about a model, and
ADR 0115's rule is that such a fact lives in `shared/model_catalogue.json` and
nowhere else. Absent means *the parameter is not sent*, which is correct for
every model that does not reason and for every id the catalogue has never seen —
a typed enterprise deployment name, a self-hosted server's own id, a vendor
release newer than this build. Posting the parameter to a model that does not
reason is a request a vendor may refuse.

**2. It is posted from `openai_compatible`, keyed by the id on the wire.** One
line serves all four adapters that share that client, and the catalogue lookup
is what keeps it correct for each: Groq's rows carry an effort, a self-hosted
server's ids are in no catalogue and carry none.

**3. The catalogue version goes to 3, and this one is not additive the way 2
was.** A reader that ignores the field posts no effort to a reasoning model and
gets an empty completion back. The field is absorbed or the row does not work.

**4. `openai/gpt-oss-20b` at `low` is the cleanup default; `openai/gpt-oss-120b`
at `low` is the agent default.** Cleanup runs inside the dictation and latency
decides it (ADR 0212's own words about that row); the agent jobs — Rewrite,
Translate, Prompt Enhance, the assistant, and the title — have nothing waiting
on them.

**`qwen/qwen3.6-27b` is catalogued and not defaulted, and the reason is the
interesting one.** It is the only row whose reasoning genuinely switches off:
zero reasoning tokens, never empty, and it sets punctuation and capitalization
where the gpt-oss rows leave them alone. It also **invents on broken input** —
`Bei c a u d e code oder codex` came back `Bei Caudé Code oder Codex`, which is
precisely
[`../known-issues/cleanup-invents-tokens-on-broken-input.md`](../known-issues/cleanup-invents-tokens-on-broken-input.md)
and has its own entry in the regression corpus. Between a model that **fails**
(gpt-oss returns empty on some short inputs, and `normalize_correction` catches
it as `empty_correction_fallback`, so the dictation keeps its raw text) and one
that **invents** (a wrong sentence that looks corrected and passes every
guardrail), this product takes the failure. The row stays in the catalogue so a
reader who wants the punctuation can pick it per job.

## Consequences

- Two Rust cases named `llama-3.3-70b-versatile` as *a Groq id on an OpenAI
  job*. A retired id is one the catalogue no longer carries, which makes it a
  typed override that legitimately passes — so both cases stopped testing their
  own subject and **failed rather than going quietly green**. That is the guard
  working, and they now name a current Groq row.
- **A stored model id that the vendor has retired is still stored.** ADR 0115 is
  explicit that the catalogue is a snapshot and not a whitelist, so an unknown id
  passes through to the wire by design — which means this machine's config keeps
  sending `llama-3.3-70b-versatile` until something moves it. That migration is
  owed and is not in this record's change; it is named here so the gap is on
  paper rather than in somebody's afternoon.
- The read date on the three Groq rows is the first in this file taken from a
  live endpoint rather than from a vendor documentation page. The source column
  says so.
