# 0096: Every drawn lane gets an adapter, and Groq stops being the only one

Date: 2026-08-11
Status: Accepted (planning direction; not implemented). Supersedes
[ADR 0065](0065-groq-is-the-only-integrated-lane-and-every-other-one-stays-drawn-and-disabled.md).

## Context

[ADR 0065](0065-groq-is-the-only-integrated-lane-and-every-other-one-stays-drawn-and-disabled.md)
decided on 2026-08-10 that Groq is the only lane WordScript integrates and every
other one keeps its drawing and is disabled. It was explicit about what kind of
decision that was: *"This is a scope decision, not a capability claim. It does
not say the other lanes are impossible or unwanted; it says exactly one is
integrated today and the surface stops implying otherwise."*

The scope changed on 2026-08-11. Asked which recogniser should carry a
conversation, the owner answered past the question: the provider build-out is
the bottleneck, it gets a session of its own whose only task is building out
every sketched provider, and it is **documented first and then integrated
completely** -- *"wir machen keine halben Sachen."*

That is the condition ADR 0065 named without naming: the reason to disable a
lane was that wiring it would mean inventing three providers. Building them is
the other answer, and it was not available while nobody had priced it. It is
priced now: [PROVIDERS.md](../PROVIDERS.md) is the survey, read against each
vendor's own documentation on 2026-08-11.

## Decision

**Every lane the surface draws gets a real adapter. Groq stops being the only
integrated one.**

Three things carry over from ADR 0065 unchanged, because they were right for
reasons that have not expired:

1. **The UI still does not change.** No lane, row, job, tab or credential field
   is deleted, moved or reworded to accommodate an adapter. The gallery owns the
   drawing (ADR 0057). What changes is whether a control can be operated.

   **Read that as a prohibition on accommodation, not a freeze.** It forbids
   reshaping the surface so a vendor fits -- moving a field, rewording a hint
   until a mismatch stops showing. It does not forbid the product gaining drawn
   vocabulary it decided to gain, and two decisions in this stack require some:
   a second credential kind on OpenAI's row (ADR 0102, ADR 0105), and whatever
   `voice` needs to be operable (ADR 0109). **Those grow the normal way** --
   gallery first, `npm run port:diff` moving with them, product surface after
   (ADR 0088). An adapter never edits a drawing; a decision may grow one.
2. **A lane that is not yet integrated stays inert and still says so.** The
   build-out lands one adapter at a time, so at every point in it some lane is
   still drawn and disabled. A disabled control with no explanation remains the
   same defect one step quieter, and the existing vocabulary -- `Button`'s
   `disabled`, `StatusBadge`'s `plan` tone, the `preview` tag -- still carries
   it.
3. **The screen keeps its banner until it is whole.** A partial wiring states
   that it is one.

**Two things come before the first adapter, and neither is one.** The capability
seam that makes a drawn row inert when the runtime denies its role does not
exist and has to be built (ADR 0106), and a credential resolves per role rather
than per provider (ADR 0105). Both are load-bearing for every adapter after the
first, and both are cheaper before ten rows depend on them.

**Then the order is by what unblocks the most, and it is a sequence rather than
a promise. Each step is gated on a drawn, operable row for the job it serves**
(ADR 0109) -- an inert lane that says so is honest, but a capability with no
control at all is not visible as missing:

- **OpenAI first.** It is the only vendor on the drawn set that serves all three
  roles alone -- recognition batch and streaming, chat, and voice -- and its
  completion event names the detected languages, which is the signal ADR 0099
  needs. The owner asked for OpenAI Realtime specifically, *as soon as the
  documentation exists*; [PROVIDERS.md](../PROVIDERS.md) is that documentation.
  Its speech and chat jobs already have rows on the lane axis; its second
  credential kind is the drawing ADR 0105 sends through the gallery.
- **Groq voice second, and it is gated.** `POST /openai/v1/audio/speech` sits on
  the connection the product already holds. No new adapter shape, no new
  credential, no new keyring entry. It is the cheapest path to a first audible
  sentence, and its limit is recorded rather than discovered: Orpheus covers
  **English and Saudi Arabic only**, so a German-English pair is speakable in
  one direction. **But the drawn `Speaking` row offers two presets, neither of
  them Groq, carries no provider mark and sits off the lane axis** -- so this
  step waits on the owner question about where the translation voice sits and on
  the gallery growing the row (ADR 0109). **If that answer is not there when
  OpenAI lands, Local moves up.** Nothing about Local depends on it.
- **Local third, with streaming.** whisper.cpp exposes a C API, ships a `stream`
  example and a `whisper-server`, and integrates Silero. The runtime shells out
  to `whisper-cli`, which takes a file. Which of those three shapes replaces it
  is the decision this step makes, and it is the same decision Phase 5 already
  carries as *whether WordScript ships an OpenAI-compatible server* -- taken
  once, not twice.
- **Then the rest**: Anthropic, Gemini, Mistral, xAI and OpenRouter on Cloud;
  Self-hosted; the Enterprise three; and the remaining voices -- Cartesia and
  local Kokoro-82M.

**The Enterprise three are three adapters, not one.** Access key plus secret
plus region; endpoint plus deployment name plus key; service-account JSON plus
project plus location. Only Azure OpenAI transcribes among them, which is what
the drawn sentence on the other two means and is confirmed in the survey:
Bedrock and Vertex serve language models, and their clouds' speech products are
separate services with separate endpoints and separate credentials.

**Every new credential follows the existing rule.** The OS secret store through
the `SecretStore` pattern `groq.rs` establishes; `AppConfig::without_secrets()`
scrubs before every disk write; nothing is hardcoded and nothing is committed.

## Consequences

- **ADR 0065's deliberately open point is dissolved rather than answered.** It
  asked which of two ways to disable the Local lane while `local_preview` stayed
  in the runtime. Building the lane removes the premise -- there is no longer a
  disabled lane to be inconsistent about. **This is not a quiet settlement of
  that question**; it is the question ceasing to apply, and if the build-out
  stalls with Local unbuilt, ADR 0065's point comes back exactly as written and
  still needs the owner.
- **`AI Models` loses its banner only when the last lane lands**, not per
  adapter. Until then it is a partial wiring and says so (rule 7).
- **`npm run port:diff` must keep reading `models` at 6 | 6** (ADR 0088). An
  adapter that changes the drawing has broken this record's first carried-over
  term. **A decision that grows the drawing moves both sides and the count still
  matches** -- that is the difference between accommodation and vocabulary, and
  the measurement is what keeps the distinction honest rather than rhetorical.
- **Onboarding reads the same `LANES` table** and will disagree with `AI Models`
  the moment one of them learns about a lane the other has not. Whatever
  enables a lane has to reach both.
- **Ten adapters is ten dependency surfaces.** `npm audit` and the Rust
  advisory sweep run per adapter, not once at the end. Enterprise
  authentication in particular pulls credential-chain machinery the crate does
  not have today.
- **The §2.5 entries this closes are closed by code, not by this record.** The
  four-value lane vocabulary and `Measured TTFB` stay on the list until an
  adapter and a measurement exist.
