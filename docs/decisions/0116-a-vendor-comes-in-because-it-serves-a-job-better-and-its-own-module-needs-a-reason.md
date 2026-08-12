# 0116: A vendor comes in because it serves a job better, and its own module needs a reason OpenRouter cannot already answer

Date: 2026-08-11
Status: Accepted (planning direction; not implemented). Widens the set
[ADR 0096](0096-every-drawn-lane-gets-an-adapter-and-groq-stops-being-the-only-one.md)
enumerated, and supplies the rule that keeps it from widening again by
accident.

## Context

The drawn provider set is ten vendors. It was chosen when the open question was
*which language model cleans up a transcript*, and it answers that question
well: seven cloud vendors and three enterprise lanes, all of them strong at
chat.

**Only five of the ten transcribe.** Anthropic serves no speech at all, Gemini
has no transcription endpoint, and Bedrock and Vertex serve language models
while their clouds' speech products sit behind separate services and separate
credentials. For a product whose north star is *trigger, speak, usable text*,
half the drawn set cannot do the first job.

**Meanwhile the vendors that are best at that job are not drawn.** Deepgram,
ElevenLabs, AssemblyAI and Speechmatics are absent, and two of them appeared in
`docs/PROVIDERS.md` only as an aside headed *"for completeness"*.

**And the reason this is not a preference is in `docs/known-issues/`.**
`stt-prompt-leaks-into-the-transcript.md` is open. WordScript's own initial
prompt is transcribed back into the output and displaces what was actually
said; ADR 0080 removes the echo from the delivery, and the record still states
plainly that *"the recogniser still produces it and the displaced words are
still gone."* The cause is structural: **Whisper's only bias channel is free
prompt text in the decoder context**, so anything this product tells the
recogniser can come back as text the user did not say.

ADR 0017 moved vocabulary out of that prompt. ADR 0081 repairs the recogniser's
output before any mode sees it. ADR 0080 strips the echo. **Three records
containing one defect class that exists because of one vendor limitation** —
and Deepgram (`keyterm=`, to 100 terms), ElevenLabs (to 1000 terms) and
AssemblyAI (`keyterms_prompt`) all bias through a parameter that never becomes
decoder text. On those lanes the defect cannot occur.

`docs/VISION.md` names transcription reliability as the most acute product gap.
The vendor set does not reflect that.

## Decision

**A vendor enters the surveyed set when it serves one of the nine jobs
materially better than every vendor already in it**, and the entry names which
job and why. Not because it is popular, not because it was asked about, and not
to make a matrix look complete.

**On that rule, four STT specialists enter now** — Deepgram, ElevenLabs,
AssemblyAI and Speechmatics — because they bias the recogniser through a
dedicated parameter, which is a capability no drawn lane has and which addresses
the defect class three of this repo's records are built to contain.

**Synthesis vendors enter as catalogue entries rather than as adapters.**
MAI-Voice-2, MiniMax, Bland, Cartesia, Voxtral TTS and the Gemini TTS previews
are surveyed and catalogued (ADR 0115). None of them gets a module by being
listed.

**A vendor gets its own module only for a reason OpenRouter cannot already
answer.** OpenRouter reaches `microsoft/mai-voice-2`,
`google/gemini-3.1-flash-tts-preview`, `mistralai/voxtral-mini-tts-2603` and
`openai/gpt-4o-mini-tts-2025-12-15` on the shape ADR 0113 extracts — one key,
zero further modules. So the question for any new synthesis vendor is not *do we
want it* but **what does a direct adapter buy that the shared shape does not**.
Two answers qualify today: Azure Speech's SSML emotion styles (which OpenRouter
does not carry) and a vendor OpenRouter does not serve at all (Bland, MiniMax,
Cartesia). *We would like it too* does not qualify.

**Surveying is not integrating, and the set is not the plan.** A vendor in
`docs/PROVIDERS.md` has been read. A vendor in `src/screens/data.ts` has been
drawn. A vendor in the registry has been built. **These are three different
statements** and this record only makes the first.

**A vendor read from secondary sources is marked as such and is not drawn.**
AssemblyAI and Speechmatics enter on capability and have not been read against
their own documentation, which is this survey's standard. They are leads until
they are read. Two of this document's best findings — that Groq does not stream,
that Cartesia publishes no TTFB — exist because a search result said otherwise.

## Consequences

- **The drawn set does not change today.** `src/screens/data.ts` still carries
  ten vendors. Growing it is a drawing (ADR 0057), and the prototype it is
  diffed against is frozen and cannot grow with it — so that step is a
  deliberate divergence, which ADR 0057 explicitly provides for: *"a difference
  is either an ADR or a bug."* This is the ADR half, filed ahead of the
  divergence rather than after it.
- **`AI Models` gets longer, and that is a design problem this record creates.**
  Seventeen vendors across four lanes on one screen is not the same surface as
  ten. Whoever grows the drawing owns that, and it is a reason to draw the
  entrants that earn a row rather than all of them.
- **ADR 0096's "every drawn lane gets an adapter" is unchanged in form and
  larger in scope.** It ties adapters to what is drawn; this record ties what is
  surveyed to what serves a job. The two meet at whatever the owner draws.
- **It does not schedule anything.** `docs/tracks/speech-track-plan.md`
  carries sequence; this record carries admission.
- **It does not settle whether a specialist replaces Groq on `dictation`.**
  Groq is the lane the product runs (ADR 0065, ADR 0002) and a replacement is a
  measurement nobody has taken. **No WER has been measured on this machine**,
  and until one is, *better* is a vendor's published claim.
