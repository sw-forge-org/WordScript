# 0118: The speaking set is complete, and the four vendors OpenRouter does not carry get their own modules

Date: 2026-08-11
Status: Accepted (planning direction; not implemented). Scoped by the owner on
2026-08-11 — *the full palette, no half measures* — answering the test
[ADR 0116](0116-a-vendor-comes-in-because-it-serves-a-job-better-and-its-own-module-needs-a-reason.md)
set and the question
[ADR 0117](0117-azure-speech-is-a-cloud-credential-not-a-second-ladder-on-azure-openais-enterprise-row.md)
left open.

## Context

ADR 0116 admits a vendor to the survey and then holds its module to a test: **a
vendor gets its own module only for a reason OpenRouter cannot already answer.**
That was the right test and it was deliberately left unanswered per vendor,
because answering it is a product decision rather than a survey finding.

ADR 0117 left the same question in a sharper form. Azure Speech's adapter was
called *optional*, on the grounds that `microsoft/mai-voice-2` is reachable
through OpenRouter, and that the ladder buys SSML and nothing else.

**The owner answered both on 2026-08-11: the palette is offered whole.** This is
the same instruction that widened ADR 0065 into ADR 0096 — *no half measures* —
applied to the ninth job instead of to the lanes.

**Four vendors pass ADR 0116's test, and each passes it for a different
reason.** They are stated per vendor because *the owner asked for all of them*
is not a reason a later reader can check.

| Vendor | What OpenRouter cannot answer |
| --- | --- |
| **Cartesia** | not served by OpenRouter at all. It is also the drawn default for the desk's voice, so the one voice this product already names has no other door |
| **Bland** | not served by OpenRouter. Its claim is a model trained on conversational rather than studio audio, which is a different output for the same input and cannot be reached through a substitute |
| **MiniMax** | not served by OpenRouter. 40 languages on `speech-2.8-hd` / `speech-2.8-turbo`, and an HD/turbo pair that lets one vendor answer both a quality and a latency row |
| **Azure Speech** | served, but **flattened**. OpenRouter carries `microsoft/mai-voice-2` without SSML, and SSML is where `mstts:express-as` lives — the eighteen emotion styles that `de-DE-Klaus` and `de-DE-Mia` carry. **No other vendor in the survey offers German expressive synthesis at that granularity**, and this product's owner works in German |

## Decision

**All four are built.** Cartesia and Bland on shape S6, MiniMax on S4 or S6
depending on whether its websocket path is taken, Azure Speech on S5 with the
region-plus-subscription-key ladder ADR 0117 describes. **Azure Speech's adapter
stops being optional**; the reason it is built is the styles, and the record
says so rather than leaving a later reader to re-derive it.

**They are additions to the OpenRouter path, not replacements for it.** Every
vendor OpenRouter does carry is still reached that way (ADR 0113). Building four
modules does not turn `microsoft/mai-voice-2`'s plain synthesis, Gemini TTS,
Voxtral TTS or `gpt-4o-mini-tts` into modules too — **the test in ADR 0116 still
governs the next vendor**, and a complete palette today is not a licence to add
a module per name later.

**The build order follows a measurement, not a preference.** Every one of these
rows is chosen on time-to-first-byte, and `docs/PROVIDERS.md` records that **not
one vendor in the survey publishes a figure this product will repeat as fact**.
So the order is: the output stream first (ADR 0097, plan step F2), then a TTFB
measurement on this machine across the candidates already reachable, then the
modules in the order that measurement justifies. **A palette assembled before
the measurement is four adapters chosen by reading marketing pages** — which is
the failure `docs/PROVIDERS.md` exists to prevent, one layer up.

**Each module still lands behind the row that operates it** (ADR 0109). Two rows
now exist to operate them (ADR 0119), so this is a schedule rather than a gate.

## Consequences

- **The `voice` role gains four adapters and the survey gains no vendors.**
  These four are already in `docs/PROVIDERS.md`; what changes is their status
  from surveyed to scheduled.
- **`AI Models`' preset control outgrows a two-option select.** It currently
  offers `Cartesia Sonic-3` and `Kokoro-82M (local)`. Seven or more providers
  behind two rows is a picker, and picking is a drawing (ADR 0057).
- **Cartesia's 3000 ms default buffer is a trap this record names in advance.**
  The API reference documents buffering configurable from 0 to 5000 ms,
  defaulting to 3000. Shipped unchanged, that is three seconds in front of every
  spoken reply, and it would be read as this product being slow.
- **Bland publishes neither a language list nor a latency figure.** Its adapter
  therefore lands with a measurement or it does not land; there is nothing on
  the vendor's pages to fall back on.
- **MiniMax is region-scoped**, `api-uw.minimax.io` versus `api.minimaxi.chat`.
  The base URL is a constant per deployment, not per vendor, and the credential
  is issued against one of them.
- **Azure Speech is public preview without an SLA**, and Microsoft says not to
  run production on it. The row that offers it says so, per the same rule that
  keeps `Not measured` on the Cartesia row.
- **This is the second time *no half measures* has widened a scope**, and both
  times it was the owner's call rather than a plan's drift. Recorded so the
  pattern is visible: ADR 0096 for the lanes, this for the voices.
