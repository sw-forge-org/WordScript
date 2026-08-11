# 0119: The speaking group has two rows, because a persona and a channel are not the same job

Date: 2026-08-11
Status: Accepted (planning direction; not implemented). **Delegated to the
implementer by the owner on 2026-08-11**, having been the open question in
[ADR 0109](0109-voice-is-the-ninth-job-and-no-adapter-lands-before-the-row-that-operates-it.md)
and open disagreement 4 in `docs/PROVIDERS.md` since it was written.

## Context

`Models.tsx` draws a `Speaking` group with exactly one row — *"The desk's
voice"*, described as *"How a coding agent's question reaches you out loud, and
how your answer returns."* It carries a preset select offering `Cartesia
Sonic-3` and `Kokoro-82M (local)`, a `Not measured` TTFB row, and a door to the
agent surface.

`Translate.tsx` draws the other half of the same subject: an output route **per
language**, and a row reading *"The voice is text-to-speech and it is named"*,
whose hint says *"The same connection every other job runs on, chosen on AI
Models like the rest"*, with a button labelled **Open AI Models**.

**So the drawing already contains a broken promise.** That button sends a reader
looking for the translation voice to a group whose only row is explicitly about
coding agents. `docs/PROVIDERS.md` recorded this as *undecided*; it is more than
undecided, because one surface already tells the user the other one answers a
question it does not answer.

ADR 0064 settled the part that is not in dispute: *"The voice itself is a model
row in AI Models, where every model choice lives"*, and the two output routings
are per machine, per language, edited in the view. What it did not settle is
**how many rows**, and that is what was left open.

## Decision

**Two rows in the `Speaking` group: the desk's voice, and the translation
voice.** Four reasons, and each of them would be enough on its own.

**1. One of them is a persona and the other is a channel.** ADR 0043 fixes the
orchestrator as *"one voice, one body: the orb"*, singular by construction, and
states that the orb *"has no meaning outside agents"*. The desk speaks **as
WordScript** — it is the product addressing its user. The translation voice
speaks **somebody else's words**, to somebody who is not a user of this product
at all. Giving one voice to both makes the product's own persona say a stranger's
sentences, which is a category error before it is a settings question.

**2. The language requirement is different, and it is not a small
difference.** The desk speaks the user's language. The translation voice speaks
**the target language**, which is by definition not the same one. Coverage
across the surveyed candidates runs from 8 languages (Kokoro-82M) through 20
(xAI), 34 (Cartesia) and 40 (MiniMax) to 70+ (`eleven_v3`) — and Groq's Orpheus
serves English and Saudi Arabic and nothing else. **One shared row would force a
single model to satisfy both requirements at once**, and the currently drawn
second option, Kokoro at 8 languages, already fails it for most pairs this
product will be asked to translate.

**3. The latency requirement is different.** The agent surface draws a rate
limit of six questions an hour; a spoken reply there can afford to be
deliberate. A translation at a table runs at conversational tempo, one utterance
per turn, with the recogniser muted for the length of each one (ADR 0098). **The
same time-to-first-byte figure is a comfort in one row and the whole feature in
the other**, so the two rows will not converge on one model even when one vendor
serves both.

**4. The cost profile is different by orders of magnitude**, for the same reason
as (3), and a user who is happy to spend on a conversation may not want the same
model narrating an agent's question.

**But one row for translation, not one per language.** The output route is
per language and stays that way (ADR 0064). The **model** is not: a TTS model is
multilingual, both directions of one conversation run through one connection and
one credential, and two model rows for one dialogue would mean two vendors, two
keys and two latency profiles inside a single exchange. **The row picks the
provider and the model once; the voice for each side of the pair is chosen on
that row**, because on some lanes the voice *is* the model id
(`de-DE-Klaus:MAI-Voice-2`) and on others it is a separate argument
(ElevenLabs' `voice_id`) — a distinction the catalogue already has to carry
(ADR 0115) and the contract already accommodates (ADR 0114).

**The row states when its model cannot speak the target language.** This is the
first genuine consumer of the catalogue's language list: a model that does not
serve the pair's other side is a row that cannot act, and it says which language
it is missing — the same shape ADR 0105 gave a missing credential, on the axis
ADR 0106 built the seam for.

**So `voice` is not the ninth job. It is the ninth and the tenth.** ADR 0109
added `voice` as one `JobKey` because four records depended on it existing;
this record splits it, because **a job is the unit at which a provider, a model
and a credential are resolved**, and two rows that pick different models are two
jobs by that definition. `JobKey` gains `voice` and `translation_voice`. Both
resolve the `Voice` role, so **one credential per provider serves both**
(ADR 0105) and neither is admissible for a subscription (ADR 0102) — the type
rules are untouched.

## Consequences

- **F1 is no longer gated on an owner answer.** ADR 0109's rule stands — no
  adapter before the row that operates it — but the row is now decided, so what
  remains is drawing it, which is the gallery's step (ADR 0057) rather than a
  question waiting on somebody.
- **`Translate.tsx`'s *Open AI Models* button acquires a true destination**, and
  its hint can name the row instead of gesturing at the screen.
- **The `Speaking` group grows a second row, and both grow a picker.** Two
  options in a select was honest when one lane was integrated; seven providers
  behind two rows is a picker, and it is a drawing.
- **ADR 0109's *ninth job* phrasing is superseded in count, not in principle.**
  Its actual rule — no adapter before its row — is what this record leans on to
  unblock F1, and every contract written against the name `voice` still resolves;
  what changes is that a second name stands beside it.
- **It does not decide the desk's model or the translation's.** Both are
  measurements nobody has taken (ADR 0118), and this record deliberately picks
  no default beyond what is already drawn.
- **It does not add a third row for the meeting HUD or live subtitles.** Neither
  speaks; both display. A row is owed the moment one of them does, and the
  reasoning above is the test to apply then: **is this a persona or a channel.**
