# Auto mode and Verbatim: why the routing does not include it

Status: closed by measurement (2026-07-30). Reopen only with new data.

This record exists so the idea is re-examined against numbers rather than
intuition. It is an appealing idea, it was proposed twice, and both times the
reasoning was wrong in a way that only measurement exposed.

## The idea

Auto currently resolves to Cleanup, Agent or Prompt Enhance. Adding Verbatim
looks free: if a transcript has nothing to clean, skip the correction call
entirely. That saves latency and provider cost and avoids the failure mode Wispr
Flow publicly identified as its biggest driver of accuracy complaints -- a
cleanup pass that "improves" text which was already fine.

## Attempt 1: workspace category

Route to Verbatim when the foreground app is a terminal, on the reasoning that
cleanup would corrupt commands, paths and flags.

Rejected immediately, and it should not have been proposed: nobody dictates shell
commands. The signal was chosen because a workspace category was available, not
because it described anything a user does. Whenever the case for a rule is "we
already have this signal", that is the smell.

## Attempt 2: a "nothing to clean" proxy

Route to Verbatim when the transcript has no filler tokens, no adjacent word
doubling, and ends in `.`, `!` or `?`.

The argument was that this is **safe by construction**: a false positive can only
happen on text that cleanup would have left alone anyway, so a wrong guess costs
nothing. That argument is false.

### The measurement

Source: `~/.config/WordScript/history.json`, 75 entries carrying both
`raw_transcript` and `transformed_transcript` from real daily use. The proxy was
evaluated against the raw transcript and compared with what the correction step
actually produced.

| | count | share |
| --- | --- | --- |
| Entries measured | 75 | |
| Satisfied the proxy ("looks clean") | 56 | 75% of all |
| **Of those, still changed by cleanup** | **30** | **54% of the 56** |
| Under 5 words | 13 | |
| Of those, changed by cleanup | 6 | 46% |

### What cleanup actually did to the "clean" ones

The proxy models cleanup as filler removal plus a final period. Cleanup does
considerably more:

| Raw | After cleanup | What changed |
| --- | --- | --- |
| `…weil wir müssen diesen Kunden closen` | `…weil wir diesen Kunden closen müssen` | German verb-final order |
| `Hier ist halt das Problem` | `Hier ist das Problem` | discourse particle |
| `auf jeden fall dokumentieren und planen als task` | `auf jeden Fall dokumentieren und planen als Task.` | capitalization, internal commas |

None of these are detectable by the proxy. Note also that the third example
satisfied the final-punctuation check while being entirely lowercase with no
internal commas -- Whisper's punctuation is not dependable enough to carry a
routing decision on its own.

## Conclusion

Whether grammar, word order and capitalization are acceptable cannot be
established without the model that fixes them. Any cheap Auto->Verbatim proxy
therefore discards real corrections in roughly half the cases it fires, and it
fires often (75% of transcripts). The saving is real but it is paid for in
silently worse output, which is the wrong trade for a dictation product.

Verbatim stays manual-only, reachable by hotkey, the overlay cycle or a profile
default, alongside Rewrite. `mode_router::resolve_auto_mode` cannot return either;
`auto_never_resolves_to_verbatim_or_rewrite` enforces it. See
[ADR 0020](../decisions/0020-the-processing-mode-is-the-only-transform-axis.md).

## What would reopen this

Not a better proxy over the same signals -- that is the thing measured and
rejected. Reopening needs one of:

- **A cheap model-side signal.** If the correction call can report "no change"
  faster or cheaper than a full pass (a small classifier, or a provider that
  bills a no-op differently), the decision moves from guessing beforehand to
  knowing afterwards.
- **A larger sample that contradicts the 54%.** 75 entries from one user in one
  language is thin. The per-session outcome is already logged; if the share of
  materially-changed "clean-looking" transcripts turns out far lower across more
  usage, the trade changes.
- **A user who wants the trade.** "Skip cleanup when the transcript looks clean"
  is a defensible *explicit* setting for someone who prefers raw output. It is not
  defensible as a silent default, which is what Auto is.
