# 0270 - Full duplex is the third implementation behind the mute seam, and it is the first feature that streams the microphone continuously

Date: 2026-09-11
Status: Accepted (planning direction; not implemented)

## Context

[ADR 0268](0268-the-desk-has-three-axes-and-a-target-names-only-one-of-them.md)
made the voice loop an axis of its own. This record fills it.

**There was already a seam, and it already had two implementations planned.**
[ADR 0098](0098-the-recogniser-goes-deaf-while-the-machine-speaks-and-that-stretch-is-not-a-shortfall.md)
decides the runtime mute -- a third capture state that stops recording while the
machine speaks and subtracts the stretch from the clock `CaptureIntegrity`
judges against -- and the roadmap names it the first implementation behind the
seam whose second is Phase 8's cascade: Silero VAD plus Smart Turn v3,
cancelling playback and generation on detected speech, recording with pre-roll.

**A third implementation became available on 2026-09-10.** GPT-Live 1 went
generally available (`gpt-live-1`,
`developers.openai.com/api/docs/models/gpt-live-1` and
`developers.openai.com/api/docs/guides/live`, both read 2026-09-11):

- **One endpoint, `v1/live/sessions`**, over WebRTC, WebSockets or SIP. Chat
  Completions, Realtime, Assistants and Batch are not available for this model.
- **Full duplex**: it listens and speaks at the same time and handles
  interruption itself, replacing the recognise-think-speak chain with one
  session.
- **$0.05 per minute, billed per second**, with backend model usage billed
  separately. No free tier. Rate limits are concurrent sessions, 25 on Tier 1 up
  to 500 on Tier 5.
- **Two delegation modes** (`developers.openai.com/api/docs/guides/live-delegation`,
  read 2026-09-11). `delegation.type: "responses"` configures a backend model --
  `delegation.responses.model`, `.instructions`, `.tools`, `.tool_choice` -- and
  OpenAI runs the thinking and the tools. `delegation.type: "client"` configures
  **no backend model at all**: the session emits `session.delegation.created`
  and the application answers over the same connection with
  `session.commentary.append`, `session.thinking.append` or
  `session.instructions.append`.
- **Both sides of the conversation arrive as text.**
  `session.input_transcript.delta` carries the user's speech,
  `session.output_transcript.delta` the assistant's, each fragment with its
  interval on the session timeline. Usage arrives as
  `session.usage.updated`, cumulative voice seconds.
- Knowledge cutoff 2025-07-31.

## Decision

**Three implementations stand behind one seam, and the local one is the
default.**

| Tier | What runs the loop | What it costs at the margin |
| --- | --- | --- |
| **1. Local cascade** | Silero VAD plus Smart Turn v3 in Rust, a local recogniser, a local voice | nothing |
| **2. Cloud cascade** | a streaming recogniser and a separate voice row, barge-in still ours | per minute of each, separately |
| **3. Full duplex** | one vendor session | per minute of open session |

**Tier 1 is what ships and what the feature is defined against.** It needs no
account, costs nothing per minute, and uploads nothing continuously. A feature
whose only implementation is tier 3 would be a feature only a paying OpenAI
customer has, and the desk is not that.

**Tier 3 runs in client delegation and the other mode is refused.** Responses
delegation would put the thinking inside the voice vendor, which collapses two
of the three axes ADR 0268 just separated, and it would bill tokens for work
[ADR 0269](0269-the-desk-s-brain-is-the-vendor-s-own-cli-started-as-a-subprocess.md)
has a plan already paying for. In client delegation the vendor is paid for
hearing, turn-taking, interruption and speech, and for nothing else. **That is
the whole reason tier 3 is affordable**: the per-minute price is the only price,
because the backend is ours.

**`session.thinking.append` is the answer to the limit Phase 8 records as
unsolvable.** The roadmap states it plainly: nothing reaches a running agent
unprompted, so a headless run that ends after eight minutes with an open
decision has spent eight minutes in silence. With a session open, the desk can
say that the run is still going while it is still going. The limit is not
removed -- there is still no channel into the run -- but the user stops being
the one who has to guess.

**GPT-Live is not a dictation path.** The transcript events would serve one:
`session.input_transcript.delta` is the user's speech as text. The price is the
refusal. Dictation is batch, one recording, one authoritative result, one
reducer commit (ADR 0018, ADR 0019), and none of that is reopened here. A live
session is for conversation, and a conversation is a thing the user starts on
purpose.

**A full-duplex session streams the microphone continuously to a vendor for as
long as it is open, and the surface says so before it opens.** This is the first
capability in the product with that property -- dictation uploads a finished
recording, and the meeting HUD is content-protected and explicit. It is stated
at the moment of choosing, the way ADR 0102 requires the subscription's
consequence to be stated at the moment of choosing, and it is visible while the
session is open rather than only at the start.

**The meter is open-session time, not usefulness.** A session that sits open
through an eight-minute run costs $0.40 whether or not anyone spoke. Tier 3
therefore ships with a budget and an idle close from the beginning; neither is a
refinement to be added after somebody's bill.

**A row for this model cannot be catalogued yet, and the reason is a finding.**
[ADR 0115](0115-a-model-name-is-a-dated-row-in-one-catalogue-and-neither-runtime-spells-it-alone.md)
puts every model id in `shared/model_catalogue.json` and nowhere else, and the
schema's `role` takes `speech`, `chat` or `voice` -- the vocabulary of
`core::providers::ProviderRole` (ADR 0105), deliberately not a second one. **A
full-duplex session is all three and none of them.** Adding the row therefore
means a fourth role in Rust and a catalogue schema bump, which is runtime work
and does not belong in a record. The row is filed as a step on the speech track,
not written here.

## Consequences

**Two vendors can be in one conversation.** The brain may be Claude Code while
the voice is OpenAI. That works and it is a sentence the surface owes the user,
beside the microphone sentence.

**The knowledge cutoff is a reason to keep tier 3 in its lane.** `gpt-live-1`
knows the world as of 2025-07-31. Irrelevant while it only hears and speaks;
a decision to let it answer anything by itself would make it relevant, and this
record does not make that decision.

**Tier 2 is not free of tier 3's disclosure.** A streaming recogniser also
receives the microphone continuously. The sentence belongs to the tier, not to
the vendor.

**The concurrent-session rate limit is recorded and does not bind.** One desk is
one session. It is written down so that a later feature wanting several does not
discover the ceiling by hitting it.

**ADR 0098 is untouched.** The runtime mute stays the first implementation, and
it stays the right one for every path that is not a full-duplex session --
including tier 2, where the machine still has to stop hearing itself.
